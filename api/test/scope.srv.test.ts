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

        const device = res.body.items.find((item: { resource: string }) => item.resource === 'device');
        assert.deepEqual(device.scopes, ['device:*', 'device:create', 'device:read', 'device:update', 'device:delete']);
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
