import { describe, it, expect, afterEach } from 'vitest';
import {
    suspendDatabase,
    resumeDatabase,
    isDatabaseSuspended,
    withDbRetry,
    isTransientDbError,
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

    it('collects deferred feature ids once', () => {
        deferFeaturePersist('a');
        deferFeaturePersist('b');
        deferFeaturePersist('a');

        expect(takeDeferredFeatureIds().sort()).toEqual(['a', 'b']);
        expect(takeDeferredFeatureIds()).toEqual([]);
    });
});
