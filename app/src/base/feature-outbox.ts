/**
 * Outbox for the user's archived Profile Features.
 *
 * A local create, edit or delete is written to the Dexie `feature` table
 * first and confirmed against the API afterwards, so a request lost to a
 * poor connection is retried rather than dropped. Rows carry `synced: false`
 * (upsert pending) or `deleted: true` (delete pending) until the server
 * acknowledges them. Mission features have their own outbox in
 * subscription-feature.ts.
 */
import { db, withDbRetry, type DBFeature } from '../database.ts';
import { server } from '../std.ts';
import { isEqual } from '@ver0/deep-equal';
import type { Feature } from '../types.ts';
import type { paths } from '@cloudtak/api-types';

type ProfileFeatureBody = paths['/api/profile/feature']['put']['requestBody']['content']['application/json'];

export const OUTBOX_RETRY_MS = 30000;

export enum OutboxState {
    Upsert = 'upsert',
    Delete = 'delete',
}

export function isPendingFeature(row: Pick<DBFeature, 'synced' | 'deleted'>): boolean {
    return row.synced === false || row.deleted === true;
}

function asFeature(row: DBFeature): Feature {
    return {
        id: row.id,
        type: 'Feature',
        path: row.path,
        properties: row.properties,
        geometry: row.geometry,
    };
}

// A transport failure means the rest of the queue would fail the same way
function isNetworkFailure(err: unknown): boolean {
    if (err instanceof TypeError) return true;
    return err instanceof Error && /timed out/i.test(err.message);
}

/** The API refused the change and will keep refusing it - retrying cannot help */
export class OutboxRejectedError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

const RETRYABLE_STATUS = new Set([401, 408, 429]);

function requestError(message: string, status?: number): Error {
    if (status !== undefined && status >= 400 && status < 500 && !RETRYABLE_STATUS.has(status)) {
        return new OutboxRejectedError(message, status);
    }

    return new Error(message);
}

let running: { promise: Promise<boolean>, again: boolean } | undefined;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

export default class FeatureOutbox {
    /** Unconfirmed local changes, mirrored from Dexie so hot paths avoid a read */
    static pending: Map<string, OutboxState> = new Map();

    /** Called once the API has confirmed a change (a 404 on delete counts) */
    static onConfirmed: ((id: string, state: OutboxState) => void) | undefined;

    static async load(): Promise<void> {
        const rows = await db.feature.filter(isPendingFeature).toArray();

        FeatureOutbox.pending.clear();
        for (const row of rows) {
            FeatureOutbox.pending.set(row.id, row.deleted ? OutboxState.Delete : OutboxState.Upsert);
        }
    }

    static isPending(id: string): boolean {
        return FeatureOutbox.pending.has(id);
    }

    static isTombstone(id: string): boolean {
        return FeatureOutbox.pending.get(id) === OutboxState.Delete;
    }

    /** The Dexie row for a feature, preserving any pending outbox state */
    static row(feat: Feature): DBFeature {
        const state = FeatureOutbox.pending.get(feat.id);

        return {
            id: feat.id,
            path: feat.path,
            properties: feat.properties,
            geometry: feat.geometry,
            ...(state ? { synced: false, deleted: state === OutboxState.Delete } : {})
        };
    }

    /** Persist a local create or edit and submit it in the background */
    static async queue(feat: Feature): Promise<void> {
        FeatureOutbox.pending.set(feat.id, OutboxState.Upsert);

        await withDbRetry(() => db.feature.put({
            id: feat.id,
            path: feat.path,
            properties: feat.properties,
            geometry: feat.geometry,
            synced: false,
            deleted: false,
            attempts: 0,
        }));

        void FeatureOutbox.push();
    }

    /** Record a change made while IndexedDB was suspended; the row is written on resume */
    static deferQueue(id: string): void {
        FeatureOutbox.pending.set(id, OutboxState.Upsert);
    }

    /** Forget an unconfirmed create or edit - the feature is being removed on purpose */
    static discard(id: string): void {
        if (FeatureOutbox.pending.get(id) === OutboxState.Upsert) {
            FeatureOutbox.pending.delete(id);
        }
    }

    /** Persist a local delete as a tombstone and submit it in the background */
    static async tombstone(feat: Feature): Promise<void> {
        FeatureOutbox.pending.set(feat.id, OutboxState.Delete);

        await withDbRetry(() => db.feature.put({
            id: feat.id,
            path: feat.path,
            properties: feat.properties,
            geometry: feat.geometry,
            synced: false,
            deleted: true,
            attempts: 0,
        }));

        void FeatureOutbox.push();
    }

    /**
     * Submit every pending change, never rejecting - failures are recorded
     * on the rows and retried later. Concurrent calls share one in-flight push.
     *
     * @returns true if every pending change was confirmed
     */
    static async push(): Promise<boolean> {
        if (running) {
            running.again = true;
            return running.promise;
        }

        const state = { again: false, promise: Promise.resolve(true) };

        state.promise = (async () => {
            try {
                let ok = true;

                do {
                    state.again = false;
                    ok = await FeatureOutbox.flush();
                } while (ok && state.again);

                if (!ok) FeatureOutbox.scheduleRetry();

                return ok;
            } catch (err) {
                console.error('FeatureOutbox: push failed', err);
                FeatureOutbox.scheduleRetry();
                return false;
            } finally {
                running = undefined;
            }
        })();

        running = state;

        return state.promise;
    }

    static cancelRetry(): void {
        if (retryTimer === undefined) return;
        clearTimeout(retryTimer);
        retryTimer = undefined;
    }

    private static scheduleRetry(): void {
        if (retryTimer !== undefined) return;

        retryTimer = setTimeout(() => {
            retryTimer = undefined;
            void FeatureOutbox.push();
        }, OUTBOX_RETRY_MS);
    }

    private static async flush(): Promise<boolean> {
        const rows = await db.feature.filter(isPendingFeature).toArray();

        let ok = true;

        for (const row of rows) {
            try {
                if (row.deleted) {
                    await FeatureOutbox.remove(row);
                } else {
                    await FeatureOutbox.submit(row);
                }
            } catch (err) {
                if (err instanceof OutboxRejectedError) {
                    await FeatureOutbox.rejected(row, err);
                    continue;
                }

                ok = false;
                await FeatureOutbox.failed(row, err);

                if (isNetworkFailure(err)) break;
            }
        }

        return ok;
    }

    private static async submit(row: DBFeature): Promise<void> {
        const { error, response } = await server.PUT('/api/profile/feature', {
            params: { query: { broadcast: false, submit: false, archive: true } },
            body: asFeature(row) as ProfileFeatureBody
        });

        if (error) throw requestError(error.message, response?.status);

        // Confirm only if the row was not changed again while the request was in flight
        await withDbRetry(() => db.transaction('rw', db.feature, async () => {
            const current = await db.feature.get(row.id);
            if (!current || current.deleted || !isEqual(asFeature(current), asFeature(row))) return;

            await db.feature.update(row.id, { synced: true, attempts: 0, error: undefined });
            FeatureOutbox.pending.delete(row.id);
            FeatureOutbox.onConfirmed?.(row.id, OutboxState.Upsert);
        }));
    }

    private static async remove(row: DBFeature): Promise<void> {
        const { error, response } = await server.DELETE('/api/profile/feature/{:id}', {
            params: { path: { ':id': row.id }, query: { permanent: false } }
        });

        if (error && response?.status !== 404) throw requestError(error.message, response?.status);

        await withDbRetry(() => db.transaction('rw', db.feature, async () => {
            const current = await db.feature.get(row.id);
            if (!current || !current.deleted) return;

            await db.feature.delete(row.id);
            FeatureOutbox.pending.delete(row.id);
            FeatureOutbox.onConfirmed?.(row.id, OutboxState.Delete);
        }));
    }

    /**
     * Give up on a change the API refused: a rejected delete drops the
     * tombstone and a rejected edit is left for the next archive load to
     * overwrite with the server copy
     */
    private static async rejected(row: DBFeature, err: OutboxRejectedError): Promise<void> {
        console.warn(`FeatureOutbox: ${row.id} rejected by the API (${err.status}): ${err.message}`);

        await withDbRetry(() => db.transaction('rw', db.feature, async () => {
            const current = await db.feature.get(row.id);
            if (!current || !isPendingFeature(current)) return;

            if (current.deleted) {
                await db.feature.delete(row.id);
            } else {
                await db.feature.update(row.id, { synced: true, error: err.message });
            }

            FeatureOutbox.pending.delete(row.id);
        }));
    }

    private static async failed(row: DBFeature, err: unknown): Promise<void> {
        const error = err instanceof Error ? err.message : String(err);

        try {
            await withDbRetry(() => db.transaction('rw', db.feature, async () => {
                const current = await db.feature.get(row.id);
                if (!current || !isPendingFeature(current)) return;

                await db.feature.update(row.id, { attempts: (current.attempts || 0) + 1, error });
            }));
        } catch (dbErr) {
            console.error(`FeatureOutbox: failed to record error for ${row.id}`, dbErr);
        }
    }
}
