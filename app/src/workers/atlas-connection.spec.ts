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
    listeners = new Map<string, Array<() => void>>();
    constructor(public url: URL) { FakeWebSocket.instances.push(this); }
    addEventListener(type: string, fn: () => void) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
    close() { this.closed = true; this.listeners.get('close')?.forEach((fn) => fn()); }
    send() { /* unused */ }
}

const { default: AtlasConnection } = await import('./atlas-connection.ts');

function makeConnection(sharingPaused: boolean) {
    const atlas = {
        sharingPaused,
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
