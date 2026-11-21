import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../std.ts', () => ({ stdurl: (url: string) => new URL(url, 'https://tak.example.com') }));
vi.mock('../database.ts', () => ({ db: {}, ChatStatusRank: {}, ChatStatus: {} }));
vi.mock('../base/chatroom.ts', () => ({ default: {} }));
vi.mock('../base/notification.ts', () => ({ default: class {}, NotificationType: {} }));
vi.mock('../base/cot.ts', () => ({ OriginMode: {} }));

class FakeWebSocket {
    static readonly OPEN = 1;
    static instances: FakeWebSocket[] = [];
    readyState = 1;
    closed = false;
    listeners = new Map<string, Array<(event?: unknown) => unknown>>();
    sent: string[] = [];
    constructor(public url: URL) { FakeWebSocket.instances.push(this); }
    addEventListener(type: string, fn: (event?: unknown) => unknown) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
    close() { this.closed = true; this.listeners.get('close')?.forEach((fn) => fn()); }
    send(data: string) { this.sent.push(data); }
    emit(type: string, event?: unknown) { return Promise.all((this.listeners.get(type) ?? []).map((fn) => fn(event))); }
}

const { default: AtlasConnection } = await import('./atlas-connection.ts');

function makeConnection(sharingPaused: boolean) {
    const atlas = {
        sharingPaused,
        sessionLabel: '',
        broadcastStandby: false,
        token: 'token',
        postMessage: vi.fn(),
        sync: { started: false, fullSync: vi.fn(async () => undefined) },
    };
    return { atlas, conn: new AtlasConnection(atlas as never) };
}

describe('AtlasConnection pause / resume', () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
        vi.stubGlobal('WebSocket', FakeWebSocket);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('never opens a socket while sharing is paused', () => {
        const { conn } = makeConnection(true);
        conn.connect('alice');
        expect(FakeWebSocket.instances).toHaveLength(0);
    });

    it('opens a socket when not paused', () => {
        const { conn } = makeConnection(false);
        conn.connect('alice');
        expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('pause closes the socket and does not reconnect', () => {
        vi.useFakeTimers();
        try {
            const { atlas, conn } = makeConnection(false);
            conn.connect('alice');
            atlas.sharingPaused = true;
            conn.pauseSharing();
            expect(FakeWebSocket.instances[0].closed).toBe(true);
            vi.advanceTimersByTime(120_000);
            expect(FakeWebSocket.instances).toHaveLength(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('a paused connect remembers the connection, so resume reconnects it', () => {
        const { atlas, conn } = makeConnection(true);
        conn.connect('alice');
        atlas.sharingPaused = false;
        conn.resumeSharing();
        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(FakeWebSocket.instances[0].url.searchParams.get('connection')).toBe('alice');
    });

    it('resume before anything ever connected does nothing', () => {
        const { conn } = makeConnection(false);
        conn.resumeSharing();
        expect(FakeWebSocket.instances).toHaveLength(0);
    });
});

describe('AtlasConnection broadcaster role', () => {
    beforeEach(() => {
        FakeWebSocket.instances = [];
        vi.stubGlobal('WebSocket', FakeWebSocket);
    });
    afterEach(() => vi.unstubAllGlobals());

    it('tells the server what this session is called', () => {
        const { atlas, conn } = makeConnection(false);
        atlas.sessionLabel = 'Pixel 8 (app)';
        conn.connect('alice');
        expect(FakeWebSocket.instances[0].url.searchParams.get('label')).toBe('Pixel 8 (app)');
    });

    it('sends no label when it has none', () => {
        const { conn } = makeConnection(false);
        conn.connect('alice');
        expect(FakeWebSocket.instances[0].url.searchParams.has('label')).toBe(false);
    });

    it('holds a Take over made while the socket is closed and sends it once open', async () => {
        const { conn } = makeConnection(false);
        conn.connect('alice');
        const ws = FakeWebSocket.instances[0];
        ws.readyState = 0;
        conn.claimBroadcast();
        expect(ws.sent).toEqual([]);
        ws.readyState = 1;
        await ws.emit('open');
        expect(ws.sent.map((raw) => JSON.parse(raw).type)).toEqual(['broadcast:claim']);
        // Only once
        await ws.emit('open');
        expect(ws.sent).toHaveLength(1);
    });

    it('sends a Take over straight away when the socket is open', () => {
        const { conn } = makeConnection(false);
        conn.connect('alice');
        conn.claimBroadcast();
        expect(FakeWebSocket.instances[0].sent.map((raw) => JSON.parse(raw).type)).toEqual(['broadcast:claim']);
    });

    it('turns the status broadcast field into standby and tells the main thread', async () => {
        const { atlas, conn } = makeConnection(false);
        conn.connect('alice');
        const ws = FakeWebSocket.instances[0];
        const status = (broadcast: object) => ws.emit('message', {
            data: JSON.stringify({ type: 'status', data: { version: conn.version, time: 't', broadcast } }),
        });
        await status({ active: false, by: 'Chrome on Windows' });
        expect(atlas.broadcastStandby).toBe(true);
        expect(atlas.postMessage).toHaveBeenCalledWith({
            type: 'cloudtak:broadcast:state',
            body: { active: false, by: 'Chrome on Windows' },
        });
        await status({ active: true });
        expect(atlas.broadcastStandby).toBe(false);
    });

    it('leaves the role alone when the server says nothing about it', async () => {
        const { atlas, conn } = makeConnection(false);
        conn.connect('alice');
        await FakeWebSocket.instances[0].emit('message', {
            data: JSON.stringify({ type: 'status', data: { version: conn.version, time: 't' } }),
        });
        expect(atlas.broadcastStandby).toBe(false);
        expect(atlas.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'cloudtak:broadcast:state' }));
    });
});
