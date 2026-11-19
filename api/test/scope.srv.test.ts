import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/scope', async () => {
    try {
        const res = await flight.fetch('/api/scope', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.total, res.body.items.length);

        const search = res.body.items.find((item: { resource: string }) => item.resource === 'search');
        assert.deepEqual(search, {
            resource: 'search',
            levels: ['read'],
            scopes: ['search:*', 'search:read'],
        });

        const group = res.body.items.find((item: { resource: string }) => item.resource === 'group');
        assert.deepEqual(group, {
            resource: 'group',
            levels: ['read', 'update'],
            scopes: ['group:*', 'group:read', 'group:update'],
        });

        const device = res.body.items.find((item: { resource: string }) => item.resource === 'device');
        assert.deepEqual(device.scopes, ['device:*', 'device:create', 'device:read', 'device:update', 'device:delete']);

        const attachment = res.body.items.find((item: { resource: string }) => item.resource === 'attachment');
        assert.deepEqual(attachment, {
            resource: 'attachment',
            levels: ['create', 'read'],
            scopes: ['attachment:*', 'attachment:create', 'attachment:read'],
        });

        const mission = res.body.items.find((item: { resource: string }) => item.resource === 'mission');
        assert.deepEqual(mission, {
            resource: 'mission',
            levels: ['create', 'read', 'update', 'delete'],
            scopes: ['mission:*', 'mission:create', 'mission:read', 'mission:update', 'mission:delete'],
        });

        const feature = res.body.items.find((item: { resource: string }) => item.resource === 'mission-feature');
        assert.deepEqual(feature.scopes, ['mission-feature:*', 'mission-feature:create', 'mission-feature:read', 'mission-feature:delete']);

        const file = res.body.items.find((item: { resource: string }) => item.resource === 'mission-file');
        assert.deepEqual(file.scopes, ['mission-file:*', 'mission-file:create', 'mission-file:delete']);

        const user = res.body.items.find((item: { resource: string }) => item.resource === 'mission-user');
        assert.deepEqual(user.scopes, ['mission-user:*', 'mission-user:create', 'mission-user:read', 'mission-user:update', 'mission-user:delete']);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/scope - no auth', async () => {
    try {
        const res = await flight.fetch('/api/scope', { method: 'GET' }, false);
        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
