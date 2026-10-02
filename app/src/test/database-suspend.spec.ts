import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import {
    suspendDatabase,
    resumeDatabase,
    isDatabaseSuspended,
    withDbRetry,
    isTransientDbError,
    isDatabaseSuspendedError,
    liveQuery,
    db,
    DatabaseSuspendedError,
    DatabaseUnavailableError,
    deferFeaturePersist,
    takeDeferredFeatureIds
} from '../database.ts';

afterEach(() => {
    resumeDatabase();
    takeDeferredFeatureIds();
});

describe('database suspend', () => {
    it('toggles and is idempotent', () => {
        expect(isDatabaseSuspended()).toBe(false);

        suspendDatabase();
        suspendDatabase();
        expect(isDatabaseSuspended()).toBe(true);

        resumeDatabase();
        resumeDatabase();
        expect(isDatabaseSuspended()).toBe(false);
    });

    it('rejects withDbRetry before the operation runs', async () => {
        suspendDatabase();

        let calls = 0;
        await expect(withDbRetry(async () => {
            calls++;
            return 1;
        })).rejects.toBeInstanceOf(DatabaseSuspendedError);

        expect(calls).toBe(0);
    });

    it('does not classify suspension or unavailability as transient', () => {
        expect(isTransientDbError(new DatabaseSuspendedError())).toBe(false);
        expect(isTransientDbError(new DatabaseUnavailableError('probe'))).toBe(false);
        expect(new DatabaseSuspendedError().name).toBe('DatabaseSuspendedError');
        expect(new DatabaseUnavailableError('probe').name).toBe('DatabaseUnavailableError');
    });

    it('matches suspension by name so it survives the worker boundary', () => {
        expect(isDatabaseSuspendedError(new DatabaseSuspendedError())).toBe(true);
        expect(isDatabaseSuspendedError(Object.assign(new Error('relayed'), { name: 'DatabaseSuspendedError' }))).toBe(true);
        expect(isDatabaseSuspendedError(new Error('other'))).toBe(false);
        expect(isDatabaseSuspendedError(null)).toBe(false);
    });

    it('keeps a liveQuery alive across suspension and re-runs it on resume', async () => {
        suspendDatabase();

        const values: number[] = [];
        const errors: unknown[] = [];
        const subscription = liveQuery(() => db.config.count()).subscribe({
            next: (value) => values.push(value),
            error: (err) => errors.push(err)
        });

        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(values).toEqual([]);
        expect(errors).toEqual([]);

        resumeDatabase();

        await expect.poll(() => values.length).toBeGreaterThan(0);
        expect(errors).toEqual([]);

        subscription.unsubscribe();
    });

    it('collects deferred feature ids once', () => {
        deferFeaturePersist('a');
        deferFeaturePersist('b');
        deferFeaturePersist('a');

        expect(takeDeferredFeatureIds().sort()).toEqual(['a', 'b']);
        expect(takeDeferredFeatureIds()).toEqual([]);
    });
});
