/**
 * FeatureHistory manages the `feature_history` Dexie table - one row per CoT
 * report at a point in time. Breadcrumb trails are drawn from these rows and
 * each keeps the properties the CoT carried when it was reported.
 *
 * Note: it does not render anything - the HistoryLayer map module observes
 * the table and draws the points & trails.
 */

import type { Observable } from 'dexie';
import {
    db,
    liveQuery,
    withDbRetry,
    FeatureHistorySource,
    type DBFeatureHistory
} from '../database.ts';
import type { Feature } from '../types.ts';

/** Anything shaped like a CoT Feature - local rows, API responses or worker inputs */
export type FeatureHistory_Input = {
    id?: string;
    path?: string;
    properties: Record<string, unknown>;
    geometry: Feature['geometry'];
};

/** Rows older than this are pruned - matches the longest window TAK Server will answer */
export const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000;

export type FeatureHistory_ListOptions = {
    uid?: string;
    /** Inclusive lower bound - epoch ms, ISO string or Date */
    start?: number | string | Date;
    /** Inclusive upper bound - epoch ms, ISO string or Date */
    end?: number | string | Date;
};

export type FeatureHistory_Span = {
    count: number;
    first: number;
    last: number;
};

function toTime(value: number | string | Date | undefined, fallback: number): number {
    if (value === undefined) return fallback;
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isNaN(time) ? fallback : time;
}

export default class FeatureHistory {
    /** Report time of a feature in epoch ms - CoT `time`, then `start`; null when neither parses */
    static timeOf(feature: FeatureHistory_Input): number | null {
        const raw = feature.properties.time ?? feature.properties.start;
        if (raw === undefined || raw === null) return null;

        const time = new Date(raw as string | number).getTime();
        return Number.isNaN(time) ? null : time;
    }

    static id(uid: string, time: number): string {
        return `${uid}@${new Date(time).toISOString()}`;
    }

    /**
     * Snapshot a feature as a history row - null when it has no usable
     * id or time, since a point in time needs both
     */
    static fromFeature(feature: FeatureHistory_Input, source: FeatureHistorySource): DBFeatureHistory | null {
        const uid = feature.id || (feature.properties.uid as string | undefined);
        if (!uid) return null;

        const time = this.timeOf(feature);
        if (time === null) return null;

        return {
            id: this.id(uid, time),
            uid,
            time,
            callsign: String(feature.properties.callsign || uid),
            type: String(feature.properties.type || ''),
            path: feature.path || '/',
            source,
            properties: {
                ...feature.properties,
                id: uid,
            } as DBFeatureHistory['properties'],
            geometry: feature.geometry,
        };
    }

    static async put(rows: DBFeatureHistory[]): Promise<number> {
        if (!rows.length) return 0;
        await withDbRetry(() => db.feature_history.bulkPut(rows));
        return rows.length;
    }

    /** Rows in the window, oldest first */
    static async list(opts: FeatureHistory_ListOptions = {}): Promise<DBFeatureHistory[]> {
        const start = toTime(opts.start, -Infinity);
        const end = toTime(opts.end, Infinity);

        if (opts.uid) {
            return db.feature_history
                .where('[uid+time]')
                .between([opts.uid, start], [opts.uid, end], true, true)
                .toArray();
        }

        return db.feature_history
            .where('time')
            .between(start, end, true, true)
            .toArray();
    }

    static stream(opts: FeatureHistory_ListOptions = {}): Observable<DBFeatureHistory[]> {
        return liveQuery(() => this.list(opts));
    }

    static async latest(uid: string): Promise<DBFeatureHistory | undefined> {
        return db.feature_history
            .where('[uid+time]')
            .between([uid, -Infinity], [uid, Infinity], true, true)
            .last();
    }

    static async count(uid?: string): Promise<number> {
        if (uid) return db.feature_history.where('uid').equals(uid).count();
        return db.feature_history.count();
    }

    /** Point count and time range per UID */
    static async spans(): Promise<Map<string, FeatureHistory_Span>> {
        const spans = new Map<string, FeatureHistory_Span>();

        await db.feature_history.orderBy('[uid+time]').each((row) => {
            const span = spans.get(row.uid);
            if (span) {
                span.count++;
                span.last = row.time;
            } else {
                spans.set(row.uid, { count: 1, first: row.time, last: row.time });
            }
        });

        return spans;
    }

    static async uids(): Promise<string[]> {
        return (await db.feature_history.orderBy('uid').uniqueKeys()) as string[];
    }

    static async clear(uid?: string): Promise<void> {
        await withDbRetry(async () => {
            if (uid) {
                await db.feature_history.where('uid').equals(uid).delete();
            } else {
                await db.feature_history.clear();
            }
        });
    }

    /** Delete rows reported before the given epoch ms, returning how many went */
    static async prune(before: number = Date.now() - HISTORY_RETENTION_MS): Promise<number> {
        return withDbRetry(() => db.feature_history.where('time').below(before).delete());
    }
}
