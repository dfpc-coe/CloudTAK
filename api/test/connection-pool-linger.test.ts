import test from 'node:test';
import assert from 'node:assert';
import ConnectionPool from '../stateful/lib/connection-pool.js';
import type { ConnectionClient } from '../stateful/lib/connection-pool.js';
import type ConfigStateful from '../stateful/config.js';
import type { ConnectionWebSocket } from '../stateful/lib/connection-web.js';

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function fakePool() {
    const destroyed: string[] = [];
    const pool = new ConnectionPool({
        wsClients: new Map(),
    } as unknown as ConfigStateful);

    pool.set('user@example.com', {
        destroy: () => destroyed.push('user@example.com'),
    } as unknown as ConnectionClient);

    return { pool, destroyed };
}

test('ConnectionPool.deleteLater: tears down after the delay when no client returned', async () => {
    const { pool, destroyed } = fakePool();

    pool.deleteLater('user@example.com', 10);
    assert.deepEqual(destroyed, []);
    assert.equal(pool.has('user@example.com'), true);

    await tick(30);
    assert.deepEqual(destroyed, ['user@example.com']);
    assert.equal(pool.has('user@example.com'), false);

    await pool.close();
});

test('ConnectionPool.keep: a returning client cancels the teardown', async () => {
    const { pool, destroyed } = fakePool();

    pool.deleteLater('user@example.com', 10);
    assert.equal(pool.keep('user@example.com'), true);
    assert.equal(pool.keep('user@example.com'), false);

    await tick(30);
    assert.deepEqual(destroyed, []);
    assert.equal(pool.has('user@example.com'), true);

    await pool.close();
});

test('ConnectionPool.deleteLater: an empty client list left by a failed attach does not block teardown', async () => {
    const { pool, destroyed } = fakePool();

    pool.deleteLater('user@example.com', 10);
    pool.config.wsClients.set('user@example.com', []);

    await tick(30);
    assert.deepEqual(destroyed, ['user@example.com']);
    assert.equal(pool.has('user@example.com'), false);

    await pool.close();
});

test('ConnectionPool.deleteLater: keeps the connection if a client is attached when the timer fires', async () => {
    const { pool, destroyed } = fakePool();

    pool.deleteLater('user@example.com', 10);
    pool.config.wsClients.set('user@example.com', [{} as ConnectionWebSocket]);

    await tick(30);
    assert.deepEqual(destroyed, []);
    assert.equal(pool.has('user@example.com'), true);

    await pool.close();
});

test('ConnectionPool.close: clears pending teardowns', async () => {
    const { pool, destroyed } = fakePool();

    pool.deleteLater('user@example.com', 10);
    await pool.close();

    assert.equal(pool.lingering.size, 0);
    assert.deepEqual(destroyed, ['user@example.com']);
});
