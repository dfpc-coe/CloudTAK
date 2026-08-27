import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    isNative: true,
    bgStart: vi.fn(),
    bgStop: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getCurrentPosition: vi.fn()
}));

vi.mock('../../utils/capacitor.ts', () => ({
    isNativePlatform: () => mocks.isNative
}));

vi.mock('@capgo/background-geolocation', () => ({
    BackgroundGeolocation: {
        start: mocks.bgStart,
        stop: mocks.bgStop
    }
}));

vi.mock('@capacitor/geolocation', () => ({
    Geolocation: {
        checkPermissions: mocks.checkPermissions,
        requestPermissions: mocks.requestPermissions,
        getCurrentPosition: mocks.getCurrentPosition
    }
}));

import { GeolocationPermission } from './geolocation.ts';
import type { DevicePermissionContext } from './types.ts';

function makeContext(): DevicePermissionContext {
    const permissions = {
        location: 'granted',
        notification: 'unknown',
        orientation: 'unknown',
        storage: 'unknown',
        camera: 'unknown',
        wakeLock: 'unknown',
        fileSystem: 'unknown'
    } as DevicePermissionContext['permissions'];

    return {
        permissions,
        setPermissionStatus: (type, state) => { permissions[type] = state; },
        getWakeLockSentinel: () => null,
        setWakeLockSentinel: () => {},
        getFileSystemHandle: () => null,
        setFileSystemHandle: () => {}
    };
}

async function flushPromises(): Promise<void> {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

describe('GeolocationPermission native watch', () => {
    beforeEach(() => {
        vi.useRealTimers();
        mocks.isNative = true;
        mocks.bgStart.mockReset();
        mocks.bgStop.mockReset().mockResolvedValue(undefined);
        mocks.checkPermissions.mockReset().mockResolvedValue({ location: 'granted' });
        mocks.requestPermissions.mockReset();
        mocks.getCurrentPosition.mockReset().mockRejectedValue(new Error('no fix'));
    });

    it('stops any orphaned native session before starting a new one', async () => {
        mocks.bgStart.mockResolvedValue('cb');

        const geo = new GeolocationPermission(makeContext());
        await geo.startWatch(() => {});

        expect(mocks.bgStop).toHaveBeenCalledTimes(1);
        expect(mocks.bgStart).toHaveBeenCalledTimes(1);
        expect(mocks.bgStop.mock.invocationCallOrder[0]).toBeLessThan(mocks.bgStart.mock.invocationCallOrder[0]);
    });

    it('retries after ALREADY_STARTED so a reloaded page regains its callback', async () => {
        mocks.bgStart
            .mockRejectedValueOnce({ code: 'ALREADY_STARTED', message: 'Location tracking already started' })
            .mockResolvedValueOnce('cb');

        const geo = new GeolocationPermission(makeContext());
        await geo.startWatch(() => {});

        expect(mocks.bgStart).toHaveBeenCalledTimes(2);
        expect(mocks.bgStop).toHaveBeenCalledTimes(2);
    });

    it('forwards native delivery options and a zero distance filter', async () => {
        mocks.bgStart.mockResolvedValue('cb');

        const geo = new GeolocationPermission(makeContext());
        await geo.startWatch(() => {}, {
            nativeDelivery: {
                url: 'https://example.com/api/profile/location',
                headers: { Authorization: 'Bearer abc' },
                minIntervalMs: 5000
            }
        });

        expect(mocks.bgStart).toHaveBeenCalledWith(expect.objectContaining({
            distanceFilter: 0,
            stale: false,
            url: 'https://example.com/api/profile/location',
            headers: { Authorization: 'Bearer abc' },
            minIntervalMs: 5000
        }), expect.any(Function));
    });

    it('delivers fixes from the native callback and restarts only after a stall', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));

        let nativeCallback: ((location?: unknown, err?: unknown) => void) | undefined;
        mocks.bgStart.mockImplementation(async (_opts: unknown, cb: typeof nativeCallback) => {
            nativeCallback = cb;
            return 'cb';
        });

        const onLocation = vi.fn();
        const geo = new GeolocationPermission(makeContext());
        await geo.startWatch(onLocation);
        await flushPromises();

        nativeCallback!({ latitude: 1, longitude: 2, accuracy: 3, time: Date.now() });
        expect(onLocation).toHaveBeenCalledTimes(1);
        expect(onLocation.mock.calls[0][0].coords).toMatchObject({ latitude: 1, longitude: 2 });

        // Recently active - no restart
        vi.advanceTimersByTime(30_000);
        await geo.ensureWatchHealthy();
        expect(mocks.bgStart).toHaveBeenCalledTimes(1);

        // Silent well past the threshold - restart with the same callback
        vi.advanceTimersByTime(200_000);
        await geo.ensureWatchHealthy();
        await flushPromises();
        expect(mocks.bgStart).toHaveBeenCalledTimes(2);

        nativeCallback!({ latitude: 4, longitude: 5, accuracy: 3, time: Date.now() });
        expect(onLocation).toHaveBeenCalledTimes(2);
    });

    it('drops fixes from a superseded watch generation', async () => {
        const callbacks: Array<(location?: unknown, err?: unknown) => void> = [];
        mocks.bgStart.mockImplementation(async (_opts: unknown, cb: (location?: unknown, err?: unknown) => void) => {
            callbacks.push(cb);
            return 'cb';
        });

        const first = vi.fn();
        const second = vi.fn();
        const geo = new GeolocationPermission(makeContext());
        await geo.startWatch(first);
        await geo.startWatch(second);

        callbacks[0]({ latitude: 1, longitude: 2, accuracy: 3, time: Date.now() });
        callbacks[1]({ latitude: 1, longitude: 2, accuracy: 3, time: Date.now() });

        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledTimes(1);
    });
});
