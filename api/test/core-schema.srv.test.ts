import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/core/schema - requires auth', async () => {
    try {
        const res = await flight.fetch('/api/core/schema', {
            method: 'GET',
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/schema', async () => {
    try {
        const res = await flight.fetch('/api/core/schema', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.total, 3);
        assert.deepEqual(res.body.items.map((item: { id: string }) => item.id), ['CoreFeature', 'CoreEvent', 'CoreDevice']);
        assert.deepEqual(res.body.items[1], {
            id: 'CoreEvent',
            title: 'Core Event',
            description: 'Incident or planned Event tracked by CloudTAK',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/schema/CoreDevice', async () => {
    try {
        const res = await flight.fetch('/api/core/schema/CoreDevice', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.$id, 'CoreDevice');
        assert.equal(res.body.type, 'object');
        assert.deepEqual(res.body.required, ['name', 'type']);
        assert.deepEqual(res.body.properties.battery, {
            'title': 'Battery',
            '@icon': 'IconBattery',
            'description': 'Battery level as a percentage (0-100) at last report',
            'minimum': 0,
            'maximum': 100,
            'type': 'number',
        });
        assert.deepEqual(res.body.properties.simulated, {
            'title': 'Simulated',
            '@icon': 'IconTestPipe',
            'description': 'Is the Device a simulated data source',
            'default': false,
            'type': 'boolean',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/schema/CoreEvent - enum & date-time properties', async () => {
    try {
        const res = await flight.fetch('/api/core/schema/CoreEvent', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.properties.priority.enum, ['none', 'low', 'medium', 'high', 'critical']);
        assert.equal(res.body.properties.priority.default, 'none');
        assert.equal(res.body.properties.ended.format, 'date-time');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/schema/CoreFeature', async () => {
    try {
        const res = await flight.fetch('/api/core/schema/CoreFeature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.required, []);
        assert.ok(res.body.properties.callsign);
        assert.ok(res.body.properties.point);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/schema/Bogus - not found', async () => {
    try {
        const res = await flight.fetch('/api/core/schema/Bogus', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404);
        assert.equal(res.body.message, 'Schema not found');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
