import type COT from '../base/cot.ts';
import type AtlasDatabase from './atlas-database.ts';
import { db, withDbRetry, isDatabaseSuspendedError, FeatureHistorySource, type DBBreadcrumb, type DBFeatureHistory } from '../database.ts';
import FeatureHistory, { type FeatureHistory_Input } from '../base/feature-history.ts';
import { WorkerMessageType } from '../utils/events.ts';
import type { HistoryChangeBody } from '../utils/events.ts';

const NOTIFY_BATCH_MS = 250;

export type BreadcrumbIngestOptions = {
    source?: FeatureHistorySource;
};

/**
 * Breadcrumb trails are discrete, timestamped `feature_history` points - one
 * per CoT report - rather than a single LineString, so the properties a CoT
 * carried at any point along its trail can be surfaced. The `breadcrumb`
 * table holds per-UID trail metadata (callsign, colour, live flag); the
 * HistoryLayer on the main thread draws both the points and the trail line.
 */
export default class AtlasBreadcrumb {
    db: AtlasDatabase;

    // Tracks which CoT UIDs have live breadcrumb trail recording enabled
    enabled: Set<string>;
    // Report time of the last point written per UID - skips duplicate reports
    last: Map<string, number>;

    // UIDs written since the main thread was last told, flushed in one batch
    private changed: Set<string>;
    private removed: Set<string>;
    private changedAll: boolean;
    private notifyTimer: ReturnType<typeof setTimeout> | null;

    constructor(db: AtlasDatabase) {
        this.db = db;
        this.enabled = new Set();
        this.last = new Map();
        this.changed = new Set();
        this.removed = new Set();
        this.changedAll = false;
        this.notifyTimer = null;
    }

    /**
     * Tell the HistoryLayer which trails to re-read. Writes are batched so a
     * burst of reports costs one message, and the layer only touches those UIDs.
     */
    private notify(uids: Iterable<string>, opts: { removed?: boolean; all?: boolean } = {}): void {
        if (opts.all) {
            this.changedAll = true;
        } else {
            for (const uid of uids) {
                if (opts.removed) {
                    this.removed.add(uid);
                    this.changed.delete(uid);
                } else {
                    this.changed.add(uid);
                }
            }
        }

        if (this.notifyTimer) return;

        this.notifyTimer = setTimeout(() => {
            this.notifyTimer = null;

            const body: HistoryChangeBody = {
                uids: [...this.changed],
                removed: [...this.removed],
                all: this.changedAll || undefined,
            };
            this.changed.clear();
            this.removed.clear();
            this.changedAll = false;

            void this.db.atlas.postMessage({ type: WorkerMessageType.History_Change, body });
        }, NOTIFY_BATCH_MS);
    }

    static trackId(uid: string): string {
        return `${uid}.track`;
    }

    /**
     * Enable or disable live breadcrumb trail recording for a given CoT UID.
     * When enabled, each incoming Point position update for that UID is
     * recorded as a `feature_history` point.
     *
     * @param uid     - The CoT UID to toggle
     * @param enabled - True to start recording, false to stop (trail is kept)
     */
    async set(uid: string, enabled: boolean): Promise<void> {
        if (enabled) {
            this.enabled.add(uid);
        } else {
            this.enabled.delete(uid);
            this.last.delete(uid);
        }

        await this.ensureTrail(uid, { live: enabled });
        this.notify([uid]);
    }

    /**
     * Remove a breadcrumb trail entirely - its metadata and every history
     * point - and disable any future live updates.
     */
    async remove(uid: string): Promise<void> {
        this.enabled.delete(uid);
        this.last.delete(uid);

        await withDbRetry(() => db.breadcrumb.delete(AtlasBreadcrumb.trackId(uid)));
        await FeatureHistory.clear(uid);
        this.notify([uid], { removed: true });
    }

    /** Remove every trail and every history point */
    async clearAll(): Promise<void> {
        this.enabled.clear();
        this.last.clear();

        await withDbRetry(() => db.breadcrumb.clear());
        await FeatureHistory.clear();
        this.notify([], { all: true });
    }

    /**
     * Returns whether live breadcrumb recording is currently enabled for the given UID
     */
    async get(uid: string): Promise<boolean> {
        return this.enabled.has(uid);
    }

    /**
     * Returns all CoT UIDs that currently have live breadcrumb recording enabled.
     * Queries the persistent Dexie store so the result survives page reloads.
     */
    async listEnabled(): Promise<string[]> {
        // `live` is a boolean, which IndexedDB cannot index, so scan the (small) table
        const rows = await db.breadcrumb.filter((r) => r.live === true).toArray();
        return rows.map((r) => r.uid);
    }

    /**
     * On startup, restore the in-memory `enabled` Set from trails persisted
     * with live: true and drop history points past the retention window.
     */
    async load(): Promise<void> {
        const all = await db.breadcrumb.toArray();

        for (const entry of all) {
            if (entry.live) this.enabled.add(entry.uid);
        }

        if (await FeatureHistory.prune() > 0) this.notify([], { all: true });
    }

    /**
     * Record a set of CoT reports as history points. Each report keeps its
     * own timestamp & properties; a report ingested twice overwrites itself.
     * Trail metadata is created for every UID seen so the History menu lists it.
     *
     * @returns the number of points written
     */
    async ingest(features: FeatureHistory_Input[], opts: BreadcrumbIngestOptions = {}): Promise<number> {
        const source = opts.source || FeatureHistorySource.History;
        const rows: DBFeatureHistory[] = [];
        const meta = new Map<string, { callsign: string; path: string }>();
        const latest = new Map<string, number>();

        for (const feature of features) {
            const row = FeatureHistory.fromFeature(feature, source);
            if (!row) continue;

            rows.push(row);

            // Trail metadata follows the newest report of each UID
            if (row.time >= (latest.get(row.uid) ?? -Infinity)) {
                latest.set(row.uid, row.time);
                meta.set(row.uid, { callsign: row.callsign, path: row.path });
            }
        }

        const count = await FeatureHistory.put(rows);

        for (const [uid, info] of meta) {
            await this.ensureTrail(uid, info);
        }

        this.notify(meta.keys());

        return count;
    }

    /**
     * @deprecated Trails are built from timestamped history points - use
     * ingest(). Kept so a caller holding bare coordinates still gets a line:
     * they are stored on the legacy `coordinates` field, which the
     * HistoryLayer draws only while the UID has no history points.
     */
    async merge(uid: string, coordinates: number[][]): Promise<void> {
        if (coordinates.length < 2) return;

        const trackId = AtlasBreadcrumb.trackId(uid);
        const existing = await db.breadcrumb.get(trackId);

        if (existing) {
            await withDbRetry(() => db.breadcrumb.put({
                ...existing,
                coordinates: [...coordinates, ...(existing.coordinates || [])],
            }));
        } else {
            await this.ensureTrail(uid, { coordinates });
        }

        this.notify([uid]);
    }

    /**
     * Called after every add() to record a history point for a Point
     * feature whose UID is in `enabled`.
     */
    async update(cot: COT): Promise<void> {
        if (cot.geometry.type !== 'Point') return;
        if (!this.enabled.has(cot.id)) return;

        const row = FeatureHistory.fromFeature(cot.as_feature(), FeatureHistorySource.Live);
        if (!row) return;

        if (this.last.get(cot.id) === row.time) return;

        try {
            await FeatureHistory.put([row]);
            this.last.set(cot.id, row.time);
            this.notify([cot.id]);
        } catch (err) {
            // Backgrounded on mobile - the position still renders, the trail just skips it
            if (!isDatabaseSuspendedError(err)) throw err;
        }
    }

    /**
     * Create the trail metadata row for a UID if it does not exist, otherwise
     * apply the given changes. Callsign, path & colour come from the tracked
     * CoT when it is in the store.
     */
    private async ensureTrail(uid: string, changes: Partial<Omit<DBBreadcrumb, 'id' | 'uid'>> = {}): Promise<DBBreadcrumb> {
        const trackId = AtlasBreadcrumb.trackId(uid);
        const existing = await db.breadcrumb.get(trackId);

        if (existing) {
            const updated = { ...existing, ...changes };
            await withDbRetry(() => db.breadcrumb.put(updated));
            return updated;
        }

        const trackedCot = this.db.cots.get(uid);

        const created: DBBreadcrumb = {
            id: trackId,
            uid,
            path: trackedCot?.path ?? '/',
            callsign: trackedCot?.properties.callsign ?? uid,
            color: (trackedCot?.properties['marker-color'] as string | undefined) || undefined,
            live: this.enabled.has(uid),
            ...changes,
        };

        await withDbRetry(() => db.breadcrumb.put(created));
        return created;
    }
}
