import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

let eventId: string;

test('GET: api/core/event - empty', async () => {
    try {
        const res = await flight.fetch('/api/core/event', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event', async () => {
    try {
        const res = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Wildfire Report',
                type: '10031000001213000000',
                priority: 'high',
                location: '1234 Main St, Boulder, CO',
                remarks: 'Fast moving fire North of Boulder',
                geometry: {
                    type: 'Point',
                    coordinates: [-105.2705, 40.015],
                },
                channels: [7, 42],
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        eventId = res.body.id;
        assert.ok(res.body.created, 'has created');
        assert.ok(res.body.updated, 'has updated');
        delete res.body.id;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            username: 'admin@example.com',
            priority: 'high',
            type: '10031000001213000000',
            name: 'Wildfire Report',
            location: '1234 Main St, Boulder, CO',
            remarks: 'Fast moving fire North of Boulder',
            geometry: {
                type: 'Point',
                coordinates: [-105.2705, 40.015],
            },
            channels: [7, 42],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, eventId);
        assert.equal(res.body.name, 'Wildfire Report');
        assert.deepEqual(res.body.channels, [7, 42]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event - hidden from user without channel access', async () => {
    try {
        const res = await flight.fetch('/api/core/event', {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event - 403 for user without channel access', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event - 403 for user without channel access', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                remarks: 'Sneaky Edit',
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                priority: 'critical',
                remarks: 'Fire has jumped the ridge',
                geometry: {
                    type: 'Point',
                    coordinates: [-105.3005, 40.0455],
                },
                channels: [1],
            },
        }, true);

        assert.equal(res.body.priority, 'critical');
        assert.equal(res.body.remarks, 'Fire has jumped the ridge');
        assert.equal(res.body.name, 'Wildfire Report');
        assert.deepEqual(res.body.geometry, {
            type: 'Point',
            coordinates: [-105.3005, 40.0455],
        });
        assert.deepEqual(res.body.channels, [1]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event - clear channels', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                channels: [],
            },
        }, true);

        assert.deepEqual(res.body.channels, []);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/:event - 403 for non-creator', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/:event', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Core Event Deleted',
        });

        const get = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(get.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
