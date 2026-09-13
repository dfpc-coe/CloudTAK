import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkerMessageType } from '../utils/events.ts';
import type { WorkerMessage, SyncTriggerReason } from '../utils/events.ts';
import AtlasConnection from '../workers/atlas-connection.ts';
import type Atlas from '../workers/atlas.ts';

type Posted = WorkerMessage[];

function fakeAtlas(): { atlas: Atlas; posted: Posted } {
    const posted: Posted = [];
    const atlas = {
        token: 'token',
        sync: { started: false, fullSync: vi.fn(async () => undefined) },
        postMessage: vi.fn(async (msg: WorkerMessage) => { posted.push(msg); })
    } as unknown as Atlas;
    return { atlas, posted };
}

function triggers(posted: Posted): SyncTriggerReason[] {
    return posted
        .filter((m) => m.type === WorkerMessageType.Sync_Trigger)
        .map((m) => (m.body as { reason: SyncTriggerReason }).reason);
}

class FakeSocket {
    static instances: FakeSocket[] = [];
    readyState = 0;
    listeners = new Map<string, Array<(ev?: unknown) => void>>();
    constructor(public url: string) { FakeSocket.instances.push(this); }
    addEventListener(type: string, fn: (ev?: unknown) => void) {
        const list = this.listeners.get(type) ?? [];
        list.push(fn);
        this.listeners.set(type, list);
    }
    emit(type: string, ev?: unknown) {
        for (const fn of this.listeners.get(type) ?? []) fn(ev);
    }
    open() { this.readyState = 1; this.emit('open'); }
    close() { this.readyState = 3; this.emit('close'); }
    send() { /* noop */ }
}

describe('AtlasConnection sync trigger', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        FakeSocket.instances = [];
        vi.stubGlobal('WebSocket', Object.assign(FakeSocket, { OPEN: 1 }));
        vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200 })));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('fires a debounced connection trigger when the socket opens', () => {
        const { atlas, posted } = fakeAtlas();
        const conn = new AtlasConnection(atlas);
        const seen: SyncTriggerReason[] = [];
        conn.onSync((reason) => seen.push(reason));

        conn.connect('user@example.com');
        FakeSocket.instances[0].open();

        expect(triggers(posted)).toEqual([]);
        vi.advanceTimersByTime(1000);

        expect(triggers(posted)).toEqual(['connection']);
        expect(seen).toEqual(['connection']);
        conn.destroy();
    });

    it('fires a network trigger on transition to online while the socket is open', () => {
        const { atlas, posted } = fakeAtlas();
        const conn = new AtlasConnection(atlas);
        conn.connect('user@example.com');
        FakeSocket.instances[0].open();
        vi.advanceTimersByTime(1000);

        conn.setOnline(false);
        conn.setOnline(false);
        conn.setOnline(true);
        conn.setOnline(true);
        vi.advanceTimersByTime(1000);

        expect(triggers(posted)).toEqual(['connection', 'network']);
        conn.destroy();
    });

    it('does not fire when the device goes offline', () => {
        const { atlas, posted } = fakeAtlas();
        const conn = new AtlasConnection(atlas);
        conn.setOnline(false);
        vi.advanceTimersByTime(5000);
        expect(triggers(posted)).toEqual([]);
        conn.destroy();
    });

    it('skips the reconnect backoff when the device comes back online', async () => {
        const { atlas, posted } = fakeAtlas();
        const conn = new AtlasConnection(atlas);
        conn.connect('user@example.com');
        FakeSocket.instances[0].open();
        vi.advanceTimersByTime(1000);

        conn.setOnline(false);
        FakeSocket.instances[0].close();
        // Let scheduleReconnect's auth probe settle and arm the backoff timer
        await vi.advanceTimersByTimeAsync(0);
        expect(FakeSocket.instances).toHaveLength(1);

        conn.setOnline(true);
        expect(FakeSocket.instances).toHaveLength(2);

        FakeSocket.instances[1].open();
        vi.advanceTimersByTime(1000);

        // Socket open inside the window wins over the network reason
        expect(triggers(posted)).toEqual(['connection', 'connection']);
        conn.destroy();
    });

    it('stops firing after destroy', () => {
        const { atlas, posted } = fakeAtlas();
        const conn = new AtlasConnection(atlas);
        conn.connect('user@example.com');
        FakeSocket.instances[0].open();
        conn.destroy();
        vi.advanceTimersByTime(5000);
        expect(triggers(posted)).toEqual([]);
    });
});
