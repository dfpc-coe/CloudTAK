import { beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (data: { isActive: boolean }) => void;

const mocks = vi.hoisted(() => ({
    isNative: true,
    isActive: true,
    listeners: new Map<string, Listener[]>(),
    removed: [] as string[]
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => mocks.isNative,
        getPlatform: () => (mocks.isNative ? 'ios' : 'web')
    }
}));

vi.mock('@capacitor/browser', () => ({ Browser: { open: vi.fn() } }));

vi.mock('@capacitor/app', () => ({
    App: {
        addListener: async (name: string, fn: Listener) => {
            const list = mocks.listeners.get(name) ?? [];
            list.push(fn);
            mocks.listeners.set(name, list);
            return { remove: async () => { mocks.removed.push(name); } };
        },
        getState: async () => ({ isActive: mocks.isActive })
    }
}));

import { addBackgroundStateListener } from './capacitor.ts';

function fire(name: string, data: { isActive: boolean } = { isActive: true }): void {
    for (const fn of mocks.listeners.get(name) ?? []) fn(data);
}

describe('addBackgroundStateListener (native)', () => {
    beforeEach(() => {
        mocks.isNative = true;
        mocks.isActive = true;
        mocks.listeners.clear();
        mocks.removed.length = 0;
    });

    it('reports the initial state once', async () => {
        const handler = vi.fn();
        await addBackgroundStateListener(handler);

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(false);
    });

    it('starts backgrounded when registered during a background wake', async () => {
        mocks.isActive = false;
        const handler = vi.fn();
        await addBackgroundStateListener(handler);

        expect(handler).toHaveBeenCalledWith(true);

        fire('resume');
        expect(handler).toHaveBeenLastCalledWith(false);
    });

    it('ignores transient inactivity that never reaches the background', async () => {
        const handler = vi.fn();
        await addBackgroundStateListener(handler);
        handler.mockClear();

        // Permission prompt / notification shade: resign active, then active again
        fire('appStateChange', { isActive: false });
        fire('appStateChange', { isActive: true });

        expect(handler).not.toHaveBeenCalled();
    });

    it('fires exactly once per real background and foreground transition', async () => {
        const handler = vi.fn();
        await addBackgroundStateListener(handler);
        handler.mockClear();

        fire('appStateChange', { isActive: false });
        fire('pause');
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenLastCalledWith(true);

        fire('resume');
        fire('appStateChange', { isActive: true });
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler).toHaveBeenLastCalledWith(false);
    });

    it('reports transient inactivity when includeInactive is set', async () => {
        const handler = vi.fn();
        await addBackgroundStateListener(handler, { includeInactive: true });
        handler.mockClear();

        fire('appStateChange', { isActive: false });
        expect(handler).toHaveBeenLastCalledWith(true);

        fire('appStateChange', { isActive: true });
        expect(handler).toHaveBeenLastCalledWith(false);
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it('removes every native listener on cleanup', async () => {
        const remove = await addBackgroundStateListener(() => {});
        remove();
        await Promise.resolve();

        expect(mocks.removed.sort()).toEqual(['appStateChange', 'pause', 'resume']);
    });
});
