import test from 'node:test';
import assert from 'node:assert';
import type { Server } from 'node:http';
import Flight from './flight.js';
import { startHubRpc } from '../lib/server/hub.js';
import RemoteHub from '../lib/hub/remote.js';

process.env.HUB_RPC_PORT = '0';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

let rpc: Server;
let hub: RemoteHub;

test('Hub RPC: start server & client', async () => {
    rpc = await startHubRpc(flight.config!);

    const address = rpc.address();
    if (!address || typeof address !== 'object') throw new Error('Could not determine Hub RPC port');

    hub = new RemoteHub(flight.config!, `http://localhost:${address.port}`);
});

test('Hub RPC: health check requires no auth', async () => {
    const address = rpc.address();
    if (!address || typeof address !== 'object') throw new Error('Could not determine Hub RPC port');

    const res = await fetch(`http://localhost:${address.port}/hub`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 200, message: 'CloudTAK Hub' });
});

test('Hub RPC: RPC calls without a token are rejected', async () => {
    const address = rpc.address();
    if (!address || typeof address !== 'object') throw new Error('Could not determine Hub RPC port');

    const res = await fetch(`http://localhost:${address.port}/hub/ws/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: [] }),
    });

    assert.equal(res.status, 401);
});

test('Hub RPC: RPC calls with a foreign-secret token are rejected', async () => {
    const address = rpc.address();
    if (!address || typeof address !== 'object') throw new Error('Could not determine Hub RPC port');

    const evil = new RemoteHub(
        Object.create(flight.config!, { SigningSecret: { value: 'not-the-signing-secret' } }),
        `http://localhost:${address.port}`,
    );

    try {
        await evil.wsPresence(['admin@example.com']);
        assert.fail('Expected an error');
    } catch (err) {
        assert.ok(err instanceof Error && 'status' in err);
        assert.equal((err as { status: number }).status, 502);
    }
});

test('Hub RPC: wsPresence round trip', async () => {
    const presence = await hub.wsPresence(['nobody@example.com']);

    assert.deepEqual(presence, {
        'nobody@example.com': {
            active: false,
            sessions: [],
        },
    });
});

test('Hub RPC: wsNotify to a user with no clients is a no-op', async () => {
    await hub.wsNotify('nobody@example.com', { type: 'sync', data: {} });
});

test('Hub RPC: connectionStatus round trip', async () => {
    const statuses = await hub.connectionStatus([0, 999999]);

    assert.ok(['live', 'dead', 'unknown'].includes(statuses['0']));
    assert.equal(statuses['999999'], 'unknown');
});

test('Hub RPC: connectionSummary round trip', async () => {
    const summary = await hub.connectionSummary();

    assert.equal(typeof summary.live, 'number');
    assert.equal(typeof summary.dead, 'number');
    assert.equal(typeof summary.unknown, 'number');
});

test('Hub RPC: submitCots ifPooled silently skips an unpooled connection', async () => {
    await hub.submitCots({
        connection: 'nobody@example.com',
        cots: [],
        ifPooled: true,
    });
});

test('Hub RPC: submitCots to an unpooled connection maps the thrown Err across the wire', async () => {
    try {
        await hub.submitCots({
            connection: 'nobody@example.com',
            cots: [],
        });
        assert.fail('Expected an error');
    } catch (err) {
        assert.ok(err instanceof Error && 'status' in err);
        assert.equal((err as { status: number }).status, 200);
        assert.equal(err.message, 'Recieved but Connection Paused');
    }
});

test('Hub RPC: geofenceStatus round trip', async () => {
    const status = await hub.geofenceStatus();

    assert.equal(typeof status.state, 'string');
    assert.equal(typeof status.enabled, 'boolean');
});

test('Hub RPC: eventSet delete round trip', async () => {
    await hub.eventSet(999999, null);
});

test('Hub RPC: stop server', async () => {
    await new Promise((resolve) => {
        rpc.closeAllConnections();
        rpc.close(resolve);
    });
});

flight.landing();
