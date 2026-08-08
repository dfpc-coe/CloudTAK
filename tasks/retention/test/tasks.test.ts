import test from 'node:test';
import assert from 'node:assert/strict';
import { tasks, type RetentionTaskConfig } from '../src/tasks.js';

test('retention tasks are registered', () => {
    assert.deepStrictEqual(
        tasks.map(task => task.name),
        ['connection-feature', 'chat', 'import', 'feature'],
    );
});

test('connection-feature is enabled unless explicitly disabled', () => {
    const task = tasks.find(t => t.name === 'connection-feature');
    assert.ok(task?.enabled);

    assert.strictEqual(task.enabled({}), true);
    assert.strictEqual(task.enabled({ 'retention::connection-feature::enabled': true }), true);
    assert.strictEqual(task.enabled({ 'retention::connection-feature::enabled': false }), false);
});

test('chat/import/feature are opt-in', () => {
    for (const name of ['chat', 'import', 'feature'] as const) {
        const task = tasks.find(t => t.name === name);
        assert.ok(task?.enabled, `${name} should define enabled()`);

        const key = `retention::${name}::enabled` as keyof RetentionTaskConfig;
        assert.strictEqual(task.enabled({}), false, `${name} default off`);
        assert.strictEqual(task.enabled({ [key]: true }), true, `${name} enabled on`);
        assert.strictEqual(task.enabled({ [key]: false }), false, `${name} disabled off`);
    }
});

test('run() throws when API_URL or SigningSecret are missing', async () => {
    const { API_URL, SigningSecret } = process.env;
    delete process.env.API_URL;
    delete process.env.SigningSecret;

    try {
        for (const task of tasks) {
            await assert.rejects(
                () => task.run(),
                /API_URL or SigningSecret not set/,
                `${task.name} should reject without credentials`,
            );
        }
    } finally {
        if (API_URL !== undefined) process.env.API_URL = API_URL;
        if (SigningSecret !== undefined) process.env.SigningSecret = SigningSecret;
    }
});
