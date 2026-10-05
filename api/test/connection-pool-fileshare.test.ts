import test from 'node:test';
import assert from 'node:assert';
import CoT, { FileShare } from '@tak-ps/node-cot';
import ConnectionPool from '../stateful/lib/connection-pool.js';
import type ImportControl from '../common/control/import.js';
import { ProfileConnConfig } from '../common/connection-config.js';
import { WebSocket_Event } from '../common/enums.js';
import type ConfigStateful from '../stateful/config.js';
import type { ConnectionWebSocket } from '../stateful/lib/connection-web.js';

function harness() {
    const sent: Array<{ type: string; data: { properties: { type: string } } }> = [];
    const imports: string[] = [];

    const client = {
        format: 'geojson',
        events: [WebSocket_Event.MAP],
        ws: { send: (msg: string) => sent.push(JSON.parse(msg)) },
    } as unknown as ConnectionWebSocket;

    const config = {
        wsClients: new Map([['user@example.com', [client]]]),
    } as unknown as ConfigStateful;

    const pool = new ConnectionPool(config);
    pool.importControl = {
        create: async (req: { name: string }) => {
            imports.push(req.name);
        },
    } as unknown as ImportControl;

    const conn = new ProfileConnConfig(config, 'user@example.com', { cert: 'cert', key: 'key' });

    return { pool, conn, sent, imports };
}

test('ConnectionPool.cots: b-f-t-r creates an Import but is not sent to map clients', async () => {
    const { pool, conn, sent, imports } = harness();

    const share = new FileShare({
        filename: 'package.zip',
        name: 'package',
        senderCallsign: 'iSchmidt',
        senderUid: 'ANDROID-other',
        senderUrl: 'https://1.2.3.4:8443/Marti/sync/content?hash=abc123',
        sha256: 'abc123',
        sizeInBytes: 1234,
    });

    await pool.cots(conn, [share]);

    assert.deepEqual(imports, ['package.zip']);
    assert.deepEqual(sent, []);

    await pool.close();
});

test('ConnectionPool.cots: b-f-t-a is not sent to map clients', async () => {
    const { pool, conn, sent, imports } = harness();

    const ack = new CoT({
        event: {
            _attributes: {
                version: '2.0',
                uid: 'ack-1',
                type: 'b-f-t-a',
                how: 'h-e',
                time: new Date().toISOString(),
                start: new Date().toISOString(),
                stale: new Date(Date.now() + 60000).toISOString(),
            },
            point: { _attributes: { lat: 39, lon: -107, hae: 9999999, ce: 9999999, le: 9999999 } },
            detail: {},
        },
    });

    await pool.cots(conn, [ack]);

    assert.deepEqual(imports, []);
    assert.deepEqual(sent, []);

    await pool.close();
});

test('ConnectionPool.cots: ordinary CoT is still sent to map clients', async () => {
    const { pool, conn, sent } = harness();

    const marker = new CoT({
        event: {
            _attributes: {
                version: '2.0',
                uid: 'marker-1',
                type: 'a-f-G',
                how: 'h-e',
                time: new Date().toISOString(),
                start: new Date().toISOString(),
                stale: new Date(Date.now() + 60000).toISOString(),
            },
            point: { _attributes: { lat: 39, lon: -107, hae: 0, ce: 9999999, le: 9999999 } },
            detail: {},
        },
    });

    await pool.cots(conn, [marker]);

    assert.equal(sent.length, 1);
    assert.equal(sent[0].type, 'cot');
    assert.equal(sent[0].data.properties.type, 'a-f-G');

    await pool.close();
});
