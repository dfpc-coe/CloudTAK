import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const start = vi.fn();
const stop = vi.fn(async () => undefined);

vi.mock('@capacitor/geolocation', () => ({
    Geolocation: { getCurrentPosition: vi.fn(async () => { throw new Error('no fix'); }), checkPermissions: vi.fn(), requestPermissions: vi.fn() },
}));
vi.mock('@capgo/background-geolocation', () => ({
    BackgroundGeolocation: { start: (...args: unknown[]) => start(...args), stop: () => stop(), openSettings: vi.fn() },
}));
vi.mock('../../utils/capacitor.ts', () => ({ isNativePlatform: () => true }));

const { GeolocationPermission } = await import('./geolocation.ts');

function make() {
    const context = { permissions: { location: 'granted' }, setPermissionStatus: vi.fn() };
    return new GeolocationPermission(context as never);
}

describe('GeolocationPermission watch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        start.mockReset();
        stop.mockClear();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => vi.useRealTimers());

    it('retries when the watcher fails to start, instead of staying dead until the app restarts', async () => {
        // First start is rejected (for example ALREADY_STARTED right after a stop), the retry works
        start.mockRejectedValueOnce(new Error('ALREADY_STARTED')).mockResolvedValue(undefined);
        const geo = make();
        await geo.startWatch(() => undefined);
        expect(start).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(2500);
        expect(start).toHaveBeenCalledTimes(2);
    });

    it('does not retry a watcher that started', async () => {
        start.mockResolvedValue(undefined);
        const geo = make();
        await geo.startWatch(() => undefined);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(start).toHaveBeenCalledTimes(1);
    });

    it('does not retry after the watch was stopped on purpose', async () => {
        start.mockRejectedValue(new Error('ALREADY_STARTED'));
        const geo = make();
        await geo.startWatch(() => undefined);
        await geo.stopWatch();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(start).toHaveBeenCalledTimes(1);
    });
});
