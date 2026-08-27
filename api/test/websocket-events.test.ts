import test from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { ConnectionWebSocket } from '../stateful/lib/connection-web.js';
import type { ConnectionClient } from '../stateful/lib/connection-pool.js';
import LocalHub from '../stateful/lib/hub/local.js';
import { WebSocket_Event } from '../common/enums.js';
import type ConfigStateful from '../stateful/config.js';

function fakeSocket(sent: string[]): WebSocket {
    return {
        readyState: WebSocket.OPEN,
        send: (raw: string) => sent.push(raw),
    } as unknown as WebSocket;
}

test('ConnectionWebSocket: answers ping with pong', async () => {
    const sent: string[] = [];
    let onMessage: ((data: string) => Promise<void>) | undefined;

    const ws = {
        readyState: WebSocket.OPEN,
        send: (raw: string) => sent.push(raw),
        on: (_event: string, handler: (data: string) => Promise<void>) => {
            onMessage = handler;
        },
    } as unknown as WebSocket;

    new ConnectionWebSocket(ws, 'geojson', [WebSocket_Event.MAP], {} as unknown as ConnectionClient);

    assert.ok(onMessage);
    await onMessage(JSON.stringify({ type: 'ping' }));

    assert.deepEqual(sent, [JSON.stringify({ type: 'pong' })]);
});

test('ConnectionWebSocket: events defaults to [map]', () => {
    const client = new ConnectionWebSocket(fakeSocket([]));

    assert.deepEqual(client.events, [WebSocket_Event.MAP]);
});

test('ConnectionWebSocket: events are deduplicated', () => {
    const client = new ConnectionWebSocket(fakeSocket([]), 'geojson', [
        WebSocket_Event.MAP,
        WebSocket_Event.VIDEO,
        WebSocket_Event.MAP,
    ]);

    assert.deepEqual(client.events, [WebSocket_Event.MAP, WebSocket_Event.VIDEO]);
});

test('ConnectionWebSocket: empty events falls back to [map]', () => {
    const client = new ConnectionWebSocket(fakeSocket([]), 'geojson', []);

    assert.deepEqual(client.events, [WebSocket_Event.MAP]);
});

test('LocalHub.wsNotify: defaults to map subscribers', async () => {
    const mapSent: string[] = [];
    const boardSent: string[] = [];

    const hub = new LocalHub({
        wsClients: new Map([['user@example.com', [
            new ConnectionWebSocket(fakeSocket(mapSent), 'geojson', [WebSocket_Event.MAP]),
            new ConnectionWebSocket(fakeSocket(boardSent), 'geojson', [WebSocket_Event.BOARD]),
        ]]]),
    } as unknown as ConfigStateful);

    await hub.wsNotify('user@example.com', { type: 'sync' });

    assert.deepEqual(mapSent, [JSON.stringify({ type: 'sync' })]);
    assert.deepEqual(boardSent, []);
});

test('LocalHub.wsNotify: scoped event only reaches its subscribers', async () => {
    const mapSent: string[] = [];
    const boardSent: string[] = [];
    const multiSent: string[] = [];

    const hub = new LocalHub({
        wsClients: new Map([['user@example.com', [
            new ConnectionWebSocket(fakeSocket(mapSent), 'geojson', [WebSocket_Event.MAP]),
            new ConnectionWebSocket(fakeSocket(boardSent), 'geojson', [WebSocket_Event.BOARD]),
            new ConnectionWebSocket(fakeSocket(multiSent), 'geojson', [WebSocket_Event.MAP, WebSocket_Event.BOARD]),
        ]]]),
    } as unknown as ConfigStateful);

    await hub.wsNotify('user@example.com', { type: 'board' }, undefined, WebSocket_Event.BOARD);

    assert.deepEqual(mapSent, []);
    assert.deepEqual(boardSent, [JSON.stringify({ type: 'board' })]);
    assert.deepEqual(multiSent, [JSON.stringify({ type: 'board' })]);
});

test('LocalHub.wsNotify: excludeSession still applies to event subscribers', async () => {
    const excludedSent: string[] = [];
    const includedSent: string[] = [];

    const hub = new LocalHub({
        wsClients: new Map([['user@example.com', [
            new ConnectionWebSocket(fakeSocket(excludedSent), 'geojson', [WebSocket_Event.VIDEO], undefined, 'session-a'),
            new ConnectionWebSocket(fakeSocket(includedSent), 'geojson', [WebSocket_Event.VIDEO], undefined, 'session-b'),
        ]]]),
    } as unknown as ConfigStateful);

    await hub.wsNotify('user@example.com', { type: 'video' }, 'session-a', WebSocket_Event.VIDEO);

    assert.deepEqual(excludedSent, []);
    assert.deepEqual(includedSent, [JSON.stringify({ type: 'video' })]);
});
