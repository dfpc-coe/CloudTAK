/**
 * Batched persistence of server-originated CoTs to the Dexie `feature` table.
 *
 * Every connection CoT used to write its own IndexedDB transaction. A burst
 * of a few hundred CoTs from the server therefore queued hundreds of
 * transactions, and on iOS WebKit those drain at only a few hundred a second
 * through a single queue shared by every store - a local point drop or delete
 * then waited seconds behind them for each of its own reads and writes.
 *
 * Writes are coalesced per feature id and flushed as a single bulkPut every
 * FLUSH_MS, with the row built from the COT's latest in-memory state at flush
 * time. Memory stays the source of truth for the map; this only moves the
 * offline cache write off the hot path. Local edits to archived features still
 * go through FeatureOutbox, which writes immediately.
 */
import { db, withDbRetry, isDatabaseSuspended, isDatabaseSuspendedError, deferFeaturePersist } from '../database.ts';
import FeatureOutbox from './feature-outbox.ts';
import type COT from './cot.ts';

export const FLUSH_MS = 250;

export default class FeatureWriter {
    /** Latest COT awaiting a write, keyed by feature id */
    static pending: Map<string, COT> = new Map();

    /**
     * Decides at flush time whether a queued COT still belongs in the cache -
     * the owning store points this at its in-memory map so a feature removed
     * after it was queued is never written back
     */
    static isLive: ((cot: COT) => boolean) | undefined;

    private static timer: ReturnType<typeof setTimeout> | undefined;
    private static flushing: Promise<void> = Promise.resolve();

    static queue(cot: COT): void {
        FeatureWriter.pending.set(cot.id, cot);

        if (FeatureWriter.timer === undefined) {
            FeatureWriter.timer = setTimeout(() => {
                void FeatureWriter.flush();
            }, FLUSH_MS);
        }
    }

    /**
     * Write every queued feature in one transaction. Flushes run one at a
     * time so a later batch can never land before an earlier one.
     */
    static flush(): Promise<void> {
        if (FeatureWriter.timer !== undefined) {
            clearTimeout(FeatureWriter.timer);
            FeatureWriter.timer = undefined;
        }

        const batch = [...FeatureWriter.pending.values()];
        FeatureWriter.pending.clear();

        FeatureWriter.flushing = FeatureWriter.flushing.then(async () => {
            const cots = batch.filter((cot) => !FeatureWriter.isLive || FeatureWriter.isLive(cot));
            if (!cots.length) return;

            // Backgrounded on native: persisted by flushDeferred() on resume
            if (isDatabaseSuspended()) {
                for (const cot of cots) deferFeaturePersist(cot.id);
                return;
            }

            const rows = cots.map((cot) => FeatureOutbox.row(cot.as_feature({ clone: true })));

            try {
                await withDbRetry(() => db.feature.bulkPut(rows));
            } catch (err) {
                if (isDatabaseSuspendedError(err)) {
                    for (const cot of cots) deferFeaturePersist(cot.id);
                } else {
                    console.error(`Failed to persist ${cots.length} feature(s)`, err);
                }
            }
        });

        return FeatureWriter.flushing;
    }

    /** Forget queued writes without persisting them - test isolation only */
    static reset(): void {
        if (FeatureWriter.timer !== undefined) clearTimeout(FeatureWriter.timer);
        FeatureWriter.timer = undefined;
        FeatureWriter.pending.clear();
        FeatureWriter.flushing = Promise.resolve();
    }
}
