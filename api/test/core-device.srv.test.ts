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

let deviceId: string;
let eventId: string;

test('GET: api/core/device - empty', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
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

test('POST: api/core/device', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Backpack Detective',
                type: '10031000001213000000',
                manufacturer: 'Ortec',
                model: 'Micro Detective',
                serial: 'MD-12345',
                firmware: 'v2.1.0',
                status: 'Full',
                battery: 87.5,
                remarks: 'Assigned to Engine 4',
                metadata: {
                    source: 'test-suite',
                },
                channels: [7, 42],
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        deviceId = res.body.id;
        assert.ok(res.body.created, 'has created');
        assert.ok(res.body.updated, 'has updated');
        delete res.body.id;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            username: 'admin@example.com',
            connection: null,
            event: null,
            type: '10031000001213000000',
            name: 'Backpack Detective',
            manufacturer: 'Ortec',
            model: 'Micro Detective',
            serial: 'MD-12345',
            firmware: 'v2.1.0',
            status: 'Full',
            battery: 87.5,
            simulated: false,
            external_id: '',
            remarks: 'Assigned to Engine 4',
            metadata: {
                source: 'test-suite',
            },
            channels: [7, 42],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/device - 400 for nonexistent event', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Orphan Device',
                type: '10031000001213000000',
                event: '00000000-0000-0000-0000-000000000000',
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/device/:device', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, deviceId);
        assert.equal(res.body.name, 'Backpack Detective');
        assert.deepEqual(res.body.channels, [7, 42]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/device - filter by shared channel', async () => {
    try {
        const res = await flight.fetch('/api/core/device?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, deviceId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/device - filter by unshared channel', async () => {
    try {
        const res = await flight.fetch('/api/core/device?channel=13', {
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

test('GET: api/core/device - hidden from user without channel access', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
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

test('GET: api/core/device/:device - 403 for user without channel access', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
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

test('PATCH: api/core/device/:device - 403 for non-creator', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
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

test('PATCH: api/core/device/:device', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                firmware: 'v2.2.0',
                status: 'Reduced',
                battery: 12,
                simulated: true,
                external_id: 'ASSET-1234',
                remarks: 'Returned for maintenance',
                channels: [1],
            },
        }, true);

        assert.equal(res.body.name, 'Backpack Detective');
        assert.equal(res.body.firmware, 'v2.2.0');
        assert.equal(res.body.status, 'Reduced');
        assert.equal(res.body.battery, 12);
        assert.equal(res.body.simulated, true);
        assert.equal(res.body.external_id, 'ASSET-1234');
        assert.equal(res.body.remarks, 'Returned for maintenance');
        assert.deepEqual(res.body.channels, [1]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/device/:device - 400 for out of range battery', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                battery: 150,
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/device/:device - update metadata', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                metadata: {
                    source: 'test-suite',
                    calibrated: '2026-08-01',
                },
            },
        }, true);

        assert.deepEqual(res.body.metadata, {
            source: 'test-suite',
            calibrated: '2026-08-01',
        });

        const replaced = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                metadata: {},
            },
        }, true);

        assert.deepEqual(replaced.body.metadata, {}, 'metadata object is replaced, not merged');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/device/:device - assign and unassign event', async () => {
    try {
        const event = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Wildfire Report',
                type: '10031000001213000000',
                geometry: {
                    type: 'Point',
                    coordinates: [-105.2705, 40.015],
                },
            },
        }, true);

        eventId = event.body.id;

        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                event: eventId,
            },
        }, true);

        assert.equal(res.body.event, eventId);

        const list = await flight.fetch(`/api/core/device?event=${eventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].id, deviceId);

        const cleared = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                event: null,
            },
        }, true);

        assert.equal(cleared.body.event, null);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/device/:device - 400 for nonexistent event', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                event: '00000000-0000-0000-0000-000000000000',
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/device/:device - clear channels', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
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
let machineDeviceId: string;

test('POST: api/connection/1/token - create machine token', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Core Device Token',
            },
        }, true);

        assert.ok(res.body.token, 'has token');
        connectionToken = res.body.token;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/device - connection token', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: connectionToken,
            },
            body: {
                name: 'Feed Sensor',
                type: '10031000001213000000',
                serial: 'FS-001',
                external_id: 'SENSOR-1',
                channels: [7],
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        machineDeviceId = res.body.id;

        assert.equal(res.body.username, null);
        assert.equal(res.body.connection, 1);
        assert.equal(res.body.name, 'Feed Sensor');
        assert.equal(res.body.manufacturer, '', 'manufacturer defaults to an empty string');
        assert.equal(res.body.battery, null, 'battery defaults to null');
        assert.equal(res.body.simulated, false, 'simulated defaults to false');
        assert.deepEqual(res.body.channels, [7]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/device - connection token scoped to own devices', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
            method: 'GET',
            auth: {
                bearer: connectionToken,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, machineDeviceId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/device/:device - 403 for connection token on user device', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
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

test('PATCH: api/core/device/:device - connection token edits own device', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${machineDeviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: connectionToken,
            },
            body: {
                status: 'Unknown',
                battery: 40,
                channels: [7, 9],
            },
        }, true);

        assert.equal(res.body.status, 'Unknown');
        assert.equal(res.body.battery, 40);
        assert.deepEqual(res.body.channels, [7, 9]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/device/:device - 403 for connection token on user device', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
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

test('PATCH: api/core/device/:device - layer token from same connection', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Core Device Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
        });

        const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');

        const res = await flight.fetch(`/api/core/device/${machineDeviceId}`, {
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

test('DELETE: api/core/device/:device - resource token cannot delete', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${machineDeviceId}`, {
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

test('DELETE: api/core/device/:device - 403 for non-creator', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
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

test('DELETE: api/core/event/:event - assigned device survives event delete', async () => {
    try {
        const assign = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                event: eventId,
            },
        }, true);

        assert.equal(assign.body.event, eventId);

        await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.event, null, 'assignment cleared by SET NULL');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/device/:device', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Core Device Deleted',
        });

        const get = await flight.fetch(`/api/core/device/${deviceId}`, {
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
