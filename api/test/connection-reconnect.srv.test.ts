/**
 * Reconnection tests - verifies node-tak recovers after a TAK server restart.
 */

import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.connection();

function pingReplyXml(): string {
    const now = new Date().toISOString();
    const stale = new Date(Date.now() + 300_000).toISOString();
    return (
        `<event version="2.0" uid="server-ping-reply" type="t-x-c-t-r" how="m-g"` +
        ` time="${now}" start="${now}" stale="${stale}">` +
        `<point lat="0.0" lon="0.0" hae="0.0" ce="9999999.0" le="9999999.0"/>` +
        `<detail/>` +
        `</event>`
    );
}

async function waitForConnectionStatus(
    expectedStatus: 'live' | 'dead',
    timeoutMs: number
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const res = await flight.fetch('/api/connection', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, false);

        const items = (res.body?.items ?? []) as Array<{ status: string; enabled: boolean }>;
        const enabled = items.filter((c) => c.enabled);
        if (enabled.length > 0 && enabled.every((c) => c.status === expectedStatus)) return;
        await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error(
        `Timed out after ${timeoutMs} ms waiting for all connections to report '${expectedStatus}'`
    );
}

async function waitForStreamingReconnect(timeoutMs: number): Promise<void> {
    if (flight.tak.streamingSockets.size > 0) return;

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(
                `Timed out after ${timeoutMs} ms waiting for streaming reconnect`
            )),
            timeoutMs
        );

        flight.tak.streaming.once('secureConnection', () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

test('Connection - reports dead before any ping reply is received', async () => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, false);

        const item = (res.body.items as Array<{ id: number; status: string }>)
            .find((c) => c.id === 1);

        assert.ok(item, 'Connection with id=1 should exist in the list');
        assert.equal(
            item.status,
            'dead',
            'Connection should report dead before a t-x-c-t-r ping reply is received'
        );
    } catch (err) {
        assert.ifError(err);
    }
});

test('Connection - becomes live after TAK server sends a ping reply', async () => {
    try {
        flight.tak.streamingWrite(pingReplyXml());

        await waitForConnectionStatus('live', 3000);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Connection - drops to dead when the TAK streaming connection is reset (simulated restart)', async () => {
    try {
        flight.tak.restartStreaming();

        await waitForConnectionStatus('dead', 3000);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Connection - reconnects and becomes live after TAK server comes back', async () => {
    try {
        // Without the race condition fix this times out - the stale socket's
        // close event destroys the new socket before the TLS handshake finishes.
        await waitForStreamingReconnect(5000);

        flight.tak.streamingWrite(pingReplyXml());

        await waitForConnectionStatus('live', 3000);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
