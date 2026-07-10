import test from 'node:test';
import assert from 'node:assert';
import ws from 'ws';
import Flight from './flight.js';
import Config from '../lib/config.js';
import server from '../index.js';
import type ServerManager from '../lib/server.js';

process.env.HUB_RPC_PORT = '0';

const POSTGRES = process.env.POSTGRES || 'postgres://postgres@localhost:5432/tak_ps_etl_test';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

let hubSrv: ServerManager;
let apiSrv: ServerManager;
let apiBase = '';

test('Split: boot a hub-mode server', async () => {
    const config = await Config.env({
        postgres: POSTGRES,
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true,
        mode: 'hub',
    });

    hubSrv = await server(config);

    assert.ok(hubSrv.rpc, 'hub exposes an RPC server');
    assert.ok(hubSrv.wss, 'hub hosts the WebSocket server');
});

test('Split: boot an api-mode server pointed at the hub', async () => {
    const rpcAddress = hubSrv.rpc!.address();
    if (!rpcAddress || typeof rpcAddress !== 'object') throw new Error('Could not determine Hub RPC port');

    const config = await Config.env({
        postgres: POSTGRES,
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true,
        mode: 'api',
        hubUrl: `http://localhost:${rpcAddress.port}`,
    });

    apiSrv = await server(config);

    assert.equal(apiSrv.wss, undefined, 'api mode hosts no WebSocket server');
    assert.equal(apiSrv.rpc, undefined, 'api mode hosts no RPC server');
    assert.throws(() => apiSrv.config.conns, /Connection Pool is not available/);
    assert.throws(() => apiSrv.config.wsClients, /WebSocket Clients are not available/);

    const address = apiSrv.server.address();
    if (!address || typeof address !== 'object') throw new Error('Could not determine API server port');
    apiBase = `http://localhost:${address.port}`;
});

test('Split: api mode requires a hub URL', async () => {
    await assert.rejects(Config.env({
        postgres: POSTGRES,
        silent: true,
        noevents: true,
        nosinks: true,
        nocache: true,
        mode: 'api',
    }), /CLOUDTAK_Hub_URL must be set/);
});

test('Split: GET /api on the stateless instance', async () => {
    const res = await fetch(`${apiBase}/api`);

    assert.equal(res.status, 200);
    const body = await res.json() as { version: string };
    assert.ok(body.version);
});

test('Split: WS upgrade on the stateless instance is refused with 426', async () => {
    const url = new URL(apiBase.replace(/^http/, 'ws'));
    url.pathname = '/api';
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const outcome = await new Promise<{ outcome: string; status?: number }>((resolve, reject) => {
        const conn = new ws(url);
        conn.on('unexpected-response', (req, res) => {
            conn.terminate();
            resolve({ outcome: 'rejected', status: res.statusCode });
        });
        conn.on('open', () => {
            conn.close();
            resolve({ outcome: 'open' });
        });
        conn.on('error', err => reject(err));
    });

    assert.deepEqual(outcome, { outcome: 'rejected', status: 426 });
});

test('Split: GET /api on the hub instance serves the health check', async () => {
    const address = hubSrv.server.address();
    if (!address || typeof address !== 'object') throw new Error('Could not determine Hub server port');

    const res = await fetch(`http://localhost:${address.port}/api`);

    assert.equal(res.status, 200);
    const body = await res.json() as { version: string };
    assert.ok(body.version);
});

test('Split: WS handshake against the hub instance completes', async () => {
    const address = hubSrv.server.address();
    if (!address || typeof address !== 'object') throw new Error('Could not determine Hub server port');

    const url = new URL(`ws://localhost:${address.port}/api`);
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const outcome = await new Promise<{ outcome: string }>((resolve, reject) => {
        const conn = new ws(url);
        conn.on('message', (data) => {
            const msg = JSON.parse(String(data));
            if (msg.type === 'connected') {
                conn.close();
                resolve({ outcome: 'connected' });
            }
        });
        conn.on('unexpected-response', () => reject(new Error('Upgrade rejected')));
        conn.on('error', err => reject(err));
    });

    assert.deepEqual(outcome, { outcome: 'connected' });
});

test('Split: connection list on the stateless instance proxies status through the hub', async () => {
    const res = await fetch(`${apiBase}/api/connection`, {
        headers: { Authorization: `Bearer ${flight.token.admin}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json() as { total: number; status: Record<string, number> };
    assert.equal(typeof body.status.live, 'number');
    assert.equal(typeof body.status.dead, 'number');
    assert.equal(typeof body.status.unknown, 'number');
});

test('Split: GET /api/server on the stateless instance reports hub connection status', async () => {
    const res = await fetch(`${apiBase}/api/server`, {
        headers: { Authorization: `Bearer ${flight.token.admin}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json() as { connection_status: string };
    assert.ok(['live', 'dead', 'unknown'].includes(body.connection_status));
});

test('Split: shut down split instances', async () => {
    await apiSrv.close();
    await hubSrv.close();
});

flight.landing();
