import test from 'node:test';
import assert from 'node:assert';
import { scheduleConnectionTeardown, cancelConnectionTeardown } from '../stateful/lib/connection-linger.js';
import type ConfigStateful from '../stateful/config.js';

function fakeConfig(clients: string[] = []) {
    const deleted: string[] = [];
    const config = {
        wsClients: new Map(clients.map(c => [c, []])),
        conns: {
            delete: (id: string) => {
                deleted.push(id);
                return true;
            },
        },
    } as unknown as ConfigStateful;

    return { config, deleted };
}

const tick = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('connection-linger: tears down after the delay when no client returned', async () => {
    const { config, deleted } = fakeConfig();

    scheduleConnectionTeardown(config, 'user@example.com', 10);
    assert.deepEqual(deleted, []);

    await tick(30);
    assert.deepEqual(deleted, ['user@example.com']);
});

test('connection-linger: a returning client cancels the teardown', async () => {
    const { config, deleted } = fakeConfig();

    scheduleConnectionTeardown(config, 'user@example.com', 10);
    assert.equal(cancelConnectionTeardown('user@example.com'), true);
    assert.equal(cancelConnectionTeardown('user@example.com'), false);

    await tick(30);
    assert.deepEqual(deleted, []);
});

test('connection-linger: keeps the connection if a client is attached when the timer fires', async () => {
    const { config, deleted } = fakeConfig();

    scheduleConnectionTeardown(config, 'user@example.com', 10);
    config.wsClients.set('user@example.com', []);

    await tick(30);
    assert.deepEqual(deleted, []);
});
