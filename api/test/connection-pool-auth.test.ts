import test from 'node:test';
import assert from 'node:assert';
import Sinon from 'sinon';
import { EventEmitter } from 'node:events';
import TAK from '@tak-ps/node-tak';
import ConnectionPool from '../stateful/lib/connection-pool.js';
import TAKServerControl from '../common/control/takserver.js';
import { ProfileConnConfig } from '../common/connection-config.js';
import type ConfigStateful from '../stateful/config.js';

class FakeTAK extends EventEmitter {
    destroyed = false;
    open = true;
    auth: { cert: string; key: string };

    constructor(auth: { cert: string; key: string }) {
        super();
        this.auth = auth;
    }

    destroy(): void {
        this.destroyed = true;
    }
}

function harness() {
    const config = {
        wsClients: new Map(),
        noconnections: true,
        server: { url: 'ssl://localhost:8089' },
    } as unknown as ConfigStateful;

    const pool = new ConnectionPool(config);

    const connect = Sinon.stub(TAK, 'connect').callsFake(async (url, auth) => {
        return new FakeTAK(auth as { cert: string; key: string }) as unknown as TAK;
    });

    const asConnection = Sinon.stub(TAKServerControl.prototype, 'asConnection').resolves({} as never);

    const profile = (auth: { cert: string; key: string }) => new ProfileConnConfig(config, 'user@example.com', auth);

    return {
        pool,
        profile,
        connect,
        close: async () => {
            connect.restore();
            asConnection.restore();
            await pool.close();
        },
    };
}

test('ConnectionPool.add: reuses the tracked connection when credentials are unchanged', async () => {
    const h = harness();

    const first = await h.pool.add(h.profile({ cert: 'cert-1', key: 'key-1' }));
    const second = await h.pool.add(h.profile({ cert: 'cert-1', key: 'key-1' }));

    assert.equal(second, first);
    assert.equal(h.connect.callCount, 1);
    assert.equal((first.tak as unknown as FakeTAK).destroyed, false);

    await h.close();
});

test('ConnectionPool.add: replaces the tracked connection when the certificate was regenerated', async () => {
    const h = harness();

    const stale = await h.pool.add(h.profile({ cert: 'cert-1', key: 'key-1' }));
    const fresh = await h.pool.add(h.profile({ cert: 'cert-2', key: 'key-2' }));

    assert.notEqual(fresh, stale);
    assert.equal(h.connect.callCount, 2);
    assert.equal((stale.tak as unknown as FakeTAK).destroyed, true);
    assert.equal((fresh.tak as unknown as FakeTAK).auth.cert, 'cert-2');
    assert.equal(h.pool.get('user@example.com'), fresh);

    await h.close();
});

test('ConnectionPool.add: a replaced connection is no longer retried', async () => {
    const h = harness();

    const stale = await h.pool.add(h.profile({ cert: 'cert-1', key: 'key-1' }));
    const retry = Sinon.spy(h.pool, 'retry');

    await h.pool.add(h.profile({ cert: 'cert-2', key: 'key-2' }));

    (stale.tak as unknown as FakeTAK).emit('close');
    assert.equal(retry.callCount, 0);

    retry.restore();
    await h.close();
});
