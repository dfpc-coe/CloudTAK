import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const prefs = new Map<string, string>();
const calls: string[] = [];

const map = {
    location: 'live',
    connectionClosedAt: null as number | null,
    worker: {
        pauseSharing: vi.fn(async () => { calls.push('worker.pause'); }),
        resumeSharing: vi.fn(async () => { calls.push('worker.resume'); }),
        claimBroadcast: vi.fn(async () => { calls.push('worker.claim'); }),
    },
    syncGeolocateControl: vi.fn(),
    startLocationWatch: vi.fn(async () => { calls.push('location.start'); }),
};
const device = {
    geolocation: {
        stopWatch: vi.fn(async () => { calls.push('location.stop'); }),
        refreshStatus: vi.fn(async () => { calls.push('location.refresh'); }),
    },
    wakeLock: { applyPreference: vi.fn(async () => { calls.push('wakelock.apply'); }) },
    releaseWakeLockSentinel: vi.fn(async () => { calls.push('wakelock.release'); }),
    getMessagingToken: vi.fn(() => 'fcm-token'),
};
let native = true;

vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
        set: vi.fn(async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value); calls.push('prefs.set'); }),
        remove: vi.fn(async ({ key }: { key: string }) => { prefs.delete(key); calls.push('prefs.remove'); }),
    },
}));
vi.mock('../utils/capacitor.ts', () => ({ isNativePlatform: () => native }));
vi.mock('../utils/events.ts', () => ({ LocationState: { Loading: 'loading', Disabled: 'disabled', Live: 'live', Preset: 'preset' } }));
vi.mock('../base/push.ts', () => ({
    syncPushToken: vi.fn(async () => { calls.push('push.sync'); }),
    unregisterPushToken: vi.fn(async () => { calls.push('push.unregister'); }),
}));
vi.mock('../base/profile.ts', () => ({ default: { get: vi.fn(async () => ({ value: 'always' })) } }));
vi.mock('./app.ts', () => ({ useAppStore: () => ({ getUsername: async () => 'alice@example.com' }) }));
vi.mock('./device.ts', () => ({ useDeviceStore: () => device }));
vi.mock('./map.ts', () => ({ useMapStore: () => map }));

const { useSharingStore, PAUSED_BY_KEY } = await import('./sharing.ts');

describe('sharing store', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        prefs.clear();
        calls.length = 0;
        native = true;
        map.location = 'live';
        map.connectionClosedAt = null;
        vi.clearAllMocks();
    });

    it('starts live when nothing was paused', async () => {
        const sharing = useSharingStore();
        expect(await sharing.load('alice@example.com')).toBe(false);
        expect(sharing.paused).toBe(false);
    });

    it('starts paused for the user who paused, and stays paused until resumed', async () => {
        prefs.set(PAUSED_BY_KEY, 'alice@example.com');
        const sharing = useSharingStore();
        expect(await sharing.load('alice@example.com')).toBe(true);
        expect(sharing.paused).toBe(true);
    });

    it('starts live for a different user and forgets the previous pause', async () => {
        prefs.set(PAUSED_BY_KEY, 'bob@example.com');
        const sharing = useSharingStore();
        expect(await sharing.load('alice@example.com')).toBe(false);
        expect(prefs.has(PAUSED_BY_KEY)).toBe(false);
    });

    it('is never paused outside the native app', async () => {
        native = false;
        prefs.set(PAUSED_BY_KEY, 'alice@example.com');
        const sharing = useSharingStore();
        expect(await sharing.load('alice@example.com')).toBe(false);
    });

    it('pause remembers the choice before stopping anything, then stops everything', async () => {
        const sharing = useSharingStore();
        await sharing.pause();
        expect(prefs.get(PAUSED_BY_KEY)).toBe('alice@example.com');
        expect(sharing.paused).toBe(true);
        expect(sharing.error).toBeNull();
        expect(calls[0]).toBe('prefs.set');
        expect(calls).toEqual(expect.arrayContaining([
            'worker.pause', 'location.stop', 'wakelock.release', 'push.unregister',
        ]));
        expect(map.location).toBe('disabled');
    });

    it('stays paused and reports it when a step fails, instead of going live', async () => {
        map.worker.pauseSharing.mockRejectedValueOnce(new Error('worker gone'));
        const sharing = useSharingStore();
        await sharing.pause();
        expect(sharing.paused).toBe(true);
        expect(prefs.get(PAUSED_BY_KEY)).toBe('alice@example.com');
        expect(sharing.error).toContain('the server connection');
        // The remaining steps still ran
        expect(calls).toEqual(expect.arrayContaining(['location.stop', 'push.unregister']));
    });

    it('resume forgets the pause and restarts connection, location, wake lock and push', async () => {
        prefs.set(PAUSED_BY_KEY, 'alice@example.com');
        const sharing = useSharingStore();
        await sharing.load('alice@example.com');
        await sharing.resume();
        expect(sharing.paused).toBe(false);
        expect(prefs.has(PAUSED_BY_KEY)).toBe(false);
        expect(calls).toEqual(expect.arrayContaining([
            'worker.resume', 'location.start', 'wakelock.apply', 'push.sync',
        ]));
    });

    it('resume refreshes permissions before restarting location, and restarts the reconnecting clock', async () => {
        prefs.set(PAUSED_BY_KEY, 'alice@example.com');
        map.connectionClosedAt = 1;
        const sharing = useSharingStore();
        await sharing.load('alice@example.com');
        const before = Date.now();
        await sharing.resume();
        expect(calls.indexOf('location.refresh')).toBeGreaterThanOrEqual(0);
        expect(calls.indexOf('location.refresh')).toBeLessThan(calls.indexOf('location.start'));
        // Otherwise the dot would be red from the moment of resuming, as the pause closed the connection long ago
        expect(map.connectionClosedAt).toBeGreaterThanOrEqual(before);
    });

    it('does nothing when pausing twice or resuming while live', async () => {
        const sharing = useSharingStore();
        await sharing.resume();
        expect(calls).toEqual([]);
        await sharing.pause();
        calls.length = 0;
        await sharing.pause();
        expect(calls).toEqual([]);
    });
    it('resume asks for the broadcaster role after everything else is back', async () => {
        prefs.set(PAUSED_BY_KEY, 'alice@example.com');
        const sharing = useSharingStore();
        await sharing.load('alice@example.com');
        await sharing.resume();
        expect(calls).toContain('worker.claim');
        expect(calls.indexOf('worker.claim')).toBeGreaterThan(calls.indexOf('worker.resume'));
    });
    it('starting live does not claim anything', async () => {
        const sharing = useSharingStore();
        await sharing.load('alice@example.com');
        expect(calls).not.toContain('worker.claim');
    });
    it('standby is only a display state until the server has reported one', () => {
        const sharing = useSharingStore();
        expect(sharing.standby).toBe(false);
        expect(sharing.broadcastKnown).toBe(false);
        sharing.setBroadcast(false, 'Pixel 8 (app)');
        expect(sharing.broadcastKnown).toBe(true);
        expect(sharing.standby).toBe(true);
        expect(sharing.standbyBy).toBe('Pixel 8 (app)');
        sharing.setBroadcast(true, null);
        expect(sharing.standby).toBe(false);
        expect(sharing.standbyBy).toBeNull();
    });
    it('takeOver asks the worker, and reports a failure instead of throwing', async () => {
        const sharing = useSharingStore();
        await sharing.takeOver();
        expect(calls).toContain('worker.claim');
        map.worker.claimBroadcast.mockRejectedValueOnce(new Error('worker gone'));
        await sharing.takeOver();
        expect(sharing.error).toBe('worker gone');
    });
});
