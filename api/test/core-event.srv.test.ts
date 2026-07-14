import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

flight.connection();

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
            connection: null,
            priority: 'high',
            type: '10031000001213000000',
            name: 'Wildfire Report',
            ended: null,
            external_id: '',
            editable: true,
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
                external_id: 'INC-1234',
                ended: '2026-07-14T12:00:00.000Z',
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
        assert.equal(res.body.external_id, 'INC-1234');
        assert.ok(res.body.ended, 'has ended');
        assert.deepEqual(res.body.geometry, {
            type: 'Point',
            coordinates: [-105.3005, 40.0455],
        });
        assert.deepEqual(res.body.channels, [1]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event - creator can disable editing', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                editable: false,
            },
        }, true);

        assert.equal(res.body.editable, false);

        const reenable = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                editable: true,
            },
        }, true);

        assert.equal(reenable.body.editable, true);
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

let connectionToken: string;
let machineEventId: string;

test('POST: api/connection/1/token - create machine token', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Core Event Token',
            },
        }, true);

        assert.ok(res.body.token, 'has token');
        connectionToken = res.body.token;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event - connection token', async () => {
    try {
        const res = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: {
                bearer: connectionToken,
            },
            body: {
                name: 'Sensor Alert',
                type: '10031000001213000000',
                priority: 'low',
                external_id: 'SENSOR-1',
                geometry: {
                    type: 'Point',
                    coordinates: [-104.9903, 39.7392],
                },
                channels: [7],
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        machineEventId = res.body.id;

        assert.equal(res.body.username, null);
        assert.equal(res.body.connection, 1);
        assert.equal(res.body.name, 'Sensor Alert');
        assert.deepEqual(res.body.channels, [7]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event - connection token scoped to own events', async () => {
    try {
        const res = await flight.fetch('/api/core/event', {
            method: 'GET',
            auth: {
                bearer: connectionToken,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, machineEventId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event - connection token', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${machineEventId}`, {
            method: 'GET',
            auth: {
                bearer: connectionToken,
            },
        }, true);

        assert.equal(res.body.id, machineEventId);
        assert.equal(res.body.connection, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event - 403 for connection token on user event', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'GET',
            auth: {
                bearer: connectionToken,
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event - connection token edits own event', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${machineEventId}`, {
            method: 'PATCH',
            auth: {
                bearer: connectionToken,
            },
            body: {
                priority: 'high',
                remarks: 'Sensor reading has increased',
                ended: '2026-07-14T12:00:00.000Z',
                channels: [7, 9],
            },
        }, true);

        assert.equal(res.body.priority, 'high');
        assert.equal(res.body.remarks, 'Sensor reading has increased');
        assert.ok(res.body.ended, 'has ended');
        assert.deepEqual(res.body.channels, [7, 9]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event - 403 for connection token on user event', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'PATCH',
            auth: {
                bearer: connectionToken,
            },
            body: {
                remarks: 'Machine Edit',
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event - layer token from same connection', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Core Event Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
        });

        const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');

        const res = await flight.fetch(`/api/core/event/${machineEventId}`, {
            method: 'PATCH',
            auth: {
                bearer: layerToken,
            },
            body: {
                remarks: 'Layer Edit',
            },
        }, true);

        assert.equal(res.body.remarks, 'Layer Edit');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/:event - resource token cannot delete', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${machineEventId}`, {
            method: 'DELETE',
            auth: {
                bearer: connectionToken,
            },
        }, false);

        assert.equal(res.status, 403);
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
