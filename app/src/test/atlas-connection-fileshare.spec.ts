import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AtlasConnection from '../workers/atlas-connection.ts';
import type Atlas from '../workers/atlas.ts';

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
    close() { this.readyState = 3; }
    send() { /* noop */ }
}

function fakeAtlas() {
    const add = vi.fn(async () => undefined);
    const atlas = {
        token: 'token',
        db: { add },
        sync: { started: false, fullSync: vi.fn(async () => undefined) },
        postMessage: vi.fn(async () => undefined)
    } as unknown as Atlas;
    return { atlas, add };
}

function feature(type: string) {
    return {
        id: `feat-${type}`,
        type: 'Feature',
        path: '/',
        properties: { id: `feat-${type}`, type, callsign: 'UNKNOWN', center: [-107, 39, 0] },
        geometry: { type: 'Point', coordinates: [-107, 39, 0] }
    };
}

async function receive(type: string) {
    const { atlas, add } = fakeAtlas();
    const conn = new AtlasConnection(atlas);
    conn.connect('user@example.com');
    const sock = FakeSocket.instances[0];
    sock.open();

    sock.emit('message', { data: JSON.stringify({ type: 'cot', connection: 'user@example.com', data: feature(type) }) });
    await vi.waitFor(() => undefined);
    await Promise.resolve();

    conn.destroy();
    return add;
}

describe('AtlasConnection file transfer CoT', () => {
    beforeEach(() => {
        FakeSocket.instances = [];
        vi.stubGlobal('WebSocket', Object.assign(FakeSocket, { OPEN: 1 }));
        vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200 })));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('drops b-f-t-r file share requests', async () => {
        const add = await receive('b-f-t-r');
        expect(add).not.toHaveBeenCalled();
    });

    it('drops b-f-t-a file share acks', async () => {
        const add = await receive('b-f-t-a');
        expect(add).not.toHaveBeenCalled();
    });

    it('still stores ordinary CoT', async () => {
        const add = await receive('a-f-G');
        expect(add).toHaveBeenCalledTimes(1);
    });
});
