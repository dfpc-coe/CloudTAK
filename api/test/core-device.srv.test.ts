import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import type { IncomingMessage, ServerResponse } from 'node:http';
import Flight from './flight.js';
import { setChannels } from '../common/models/CoreEntity.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });
flight.integration('test-task');

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
            editable: true,
            links: [],
            style: {},
            geometry: null,
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
            external_ids: {},
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
                external_id: { system: 'asset', value: 'ASSET-1234' },
                remarks: 'Returned for maintenance',
                geometry: {
                    type: 'Point',
                    coordinates: [-105.2705, 40.015],
                },
                links: [{ name: 'Manual', url: 'https://example.com/manual.pdf' }],
                channels: [1],
            },
        }, true);

        assert.equal(res.body.name, 'Backpack Detective');
        assert.deepEqual(res.body.geometry, { type: 'Point', coordinates: [-105.2705, 40.015] });
        assert.deepEqual(res.body.links, [{ name: 'Manual', url: 'https://example.com/manual.pdf' }]);
        assert.equal(res.body.firmware, 'v2.2.0');
        assert.equal(res.body.status, 'Reduced');
        assert.equal(res.body.battery, 12);
        assert.equal(res.body.simulated, true);
        assert.deepEqual(res.body.external_ids, { asset: 'ASSET-1234' });
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

test('PATCH: api/core/device/:device - channels cannot be cleared', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                channels: [],
            },
        }, false);

        assert.equal(res.status, 400);

        const current = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(current.body.channels, [1]);
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
                permissions: ['device:*', 'event:*'],
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
                external_id: { system: 'feed', value: 'SENSOR-1' },
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

test('POST: api/core/device - 400 for a user without channels', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'No Channels',
                type: '10031000001213000000',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'channels is required - at least one Channel to share the Device with');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/device - 400 for a connection token whose Connection has no active Channels', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: connectionToken,
            },
            body: {
                name: 'No Channels',
                type: '10031000001213000000',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'The Connection has no active Channels to share the Device with - provide channels');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/device - connection token inherits the Channels of the Connection', async () => {
    try {
        const groups = [
            { name: 'Ops', direction: 'IN', created: '2026-01-01', type: 'SYSTEM', bitpos: 4, active: true },
            { name: 'Ops', direction: 'OUT', created: '2026-01-01', type: 'SYSTEM', bitpos: 4, active: true },
            { name: 'Inactive', direction: 'IN', created: '2026-01-01', type: 'SYSTEM', bitpos: 6, active: false },
        ];

        flight.tak.mockMarti.unshift(async (request: IncomingMessage, response: ServerResponse) => {
            if (request.method !== 'GET' || request.url !== '/Marti/api/groups/all?useCache=true') return false;

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({ version: '3', type: 'com.bbn.marti.remote.groups.Group', data: groups }));
            response.end();
            return true;
        });
        await flight.refreshChannels(1);

        const res = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: connectionToken,
            },
            body: {
                name: 'Inherited Channels',
                type: '10031000001213000000',
                external_id: { system: 'feed', value: 'SENSOR-2' },
            },
        }, true);

        assert.equal(res.body.connection, 1);
        assert.deepEqual(res.body.channels, [4]);

        flight.tak.mockMarti.shift();
        await flight.refreshChannels(1);

        await flight.fetch(`/api/core/device/${res.body.id}`, {
            method: 'DELETE',
            auth: {
                bearer: connectionToken,
            },
        }, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/device/:device - a Device without channels inherits the Channels of its Connection', async () => {
    try {
        const created = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: connectionToken,
            },
            body: {
                name: 'Orphaned Sensor',
                type: '10031000001213000000',
                channels: [7],
            },
        }, true);

        // Devices created before sharing was required may have no channels
        await setChannels(flight.config!.pg, created.body.id, []);

        const groups = [
            { name: 'Ops', direction: 'IN', created: '2026-01-01', type: 'SYSTEM', bitpos: 4, active: true },
            { name: 'Ops', direction: 'OUT', created: '2026-01-01', type: 'SYSTEM', bitpos: 4, active: true },
        ];

        flight.tak.mockMarti.unshift(async (request: IncomingMessage, response: ServerResponse) => {
            if (request.method !== 'GET' || request.url !== '/Marti/api/groups/all?useCache=true') return false;

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({ version: '3', type: 'com.bbn.marti.remote.groups.Group', data: groups }));
            response.end();
            return true;
        });
        await flight.refreshChannels(1);

        const res = await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'PATCH',
            auth: {
                bearer: connectionToken,
            },
            body: {
                status: 'Reduced',
            },
        }, true);

        assert.equal(res.body.status, 'Reduced');
        assert.deepEqual(res.body.channels, [4]);

        // Once shared, a PATCH without channels leaves the assignment alone
        const again = await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'PATCH',
            auth: {
                bearer: connectionToken,
            },
            body: {
                status: 'Full',
            },
        }, true);

        assert.deepEqual(again.body.channels, [4]);

        flight.tak.mockMarti.shift();
        await flight.refreshChannels(1);

        await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'DELETE',
            auth: {
                bearer: connectionToken,
            },
        }, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/device - 400 for an external_id already used by the Connection', async () => {
    try {
        const res = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: connectionToken,
            },
            body: {
                name: 'Duplicate Sensor',
                type: '10031000001213000000',
                external_id: { system: 'feed', value: 'SENSOR-1' },
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/device/:device - 400 for an external_id already used by the Connection', async () => {
    try {
        const created = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: connectionToken,
            },
            body: {
                name: 'Second Sensor',
                type: '10031000001213000000',
                external_id: { system: 'feed', value: 'SENSOR-2' },
                channels: [7],
            },
        }, true);

        const res = await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'PATCH',
            auth: {
                bearer: connectionToken,
            },
            body: {
                external_id: { system: 'feed', value: 'SENSOR-1' },
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'external_id is already used by another Device of the Connection');

        // The same value under another system is a different ID
        const other = await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'PATCH',
            auth: {
                bearer: connectionToken,
            },
            body: {
                external_id: { system: 'other', value: 'SENSOR-1' },
            },
        }, true);

        assert.deepEqual(other.body.external_ids, { feed: 'SENSOR-2', other: 'SENSOR-1' });

        await flight.config!.models.CoreDevice.delete(created.body.id);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event - an Event of the Connection may share the external_id of a Device', async () => {
    try {
        const res = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: {
                bearer: connectionToken,
            },
            body: {
                name: 'Sensor Alarm',
                type: '10031000001213000000',
                external_id: { system: 'feed', value: 'SENSOR-1' },
                geometry: {
                    type: 'Point',
                    coordinates: [-105.2705, 40.015],
                },
                channels: [7],
            },
        }, true);

        assert.deepEqual(res.body.external_ids, { feed: 'SENSOR-1' });

        const device = await flight.fetch(`/api/core/device/${res.body.id}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(device.status, 404, 'an Event is not served as a Device');

        await flight.fetch(`/api/core/event/${res.body.id}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);
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

// The mock TAK Server reports no channels by default - report channel 7 active
// for every certificate so Connection 1 shares a channel with a user Device
const channelSeven = async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    if (request.method !== 'GET' || request.url !== '/Marti/api/groups/all?useCache=true') return false;

    response.setHeader('Content-Type', 'application/json');
    response.write(JSON.stringify({
        version: '3',
        type: 'com.bbn.marti.remote.groups.Group',
        data: [{ name: 'SAR', direction: 'IN', created: '2026-01-01', type: 'SYSTEM', bitpos: 7, active: true, description: '' }],
    }));
    response.end();
    return true;
};

test('GET: api/core/device/:device - connection token with a shared channel active', async () => {
    try {
        flight.tak.mockMarti.unshift(channelSeven);
        await flight.refreshChannels(1);

        // Created by a user, not the Connection, and shared with channel 7
        const created = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Shared Detector',
                type: '10031000001213000000',
                channels: [7],
            },
        }, true);

        const res = await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'GET',
            auth: {
                bearer: connectionToken,
            },
        }, true);

        assert.equal(res.body.id, created.body.id);
        assert.equal(res.body.connection, null);
        assert.deepEqual(res.body.channels, [7]);

        // Visible is not editable - only the creator may modify a Device
        const patch = await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'PATCH',
            auth: {
                bearer: connectionToken,
            },
            body: {
                remarks: 'Machine Edit',
            },
        }, false);

        assert.equal(patch.status, 403);

        flight.tak.mockMarti.splice(flight.tak.mockMarti.indexOf(channelSeven), 1);
        await flight.refreshChannels(1);

        const inactive = await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'GET',
            auth: {
                bearer: connectionToken,
            },
        }, false);

        assert.equal(inactive.status, 403);

        await flight.fetch(`/api/core/device/${created.body.id}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);
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
            task: 1,
            version: '1.0.0',
            connection: 1,
            permissions: ['device:update'],
        });

        await flight.config!.models.Layer.generate({
            name: 'Unscoped Layer',
            task: 1,
            version: '1.0.0',
            connection: 1,
            permissions: ['device:read'],
        });

        const unscopedToken = 'etl.' + jwt.sign({ access: 'layer', id: 2, internal: true }, 'coe-wildland-fire');

        const denied = await flight.fetch(`/api/core/device/${machineDeviceId}`, {
            method: 'PATCH',
            auth: { bearer: unscopedToken },
            body: { remarks: 'Layer Edit' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Layer token does not have the device:update permission');

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

test('DELETE: api/core/device/:device - layer token without device:delete', async () => {
    try {
        const unscopedToken = 'etl.' + jwt.sign({ access: 'layer', id: 2, internal: true }, 'coe-wildland-fire');

        const res = await flight.fetch(`/api/core/device/${machineDeviceId}`, {
            method: 'DELETE',
            auth: { bearer: unscopedToken },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the device:delete permission');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/device/:device - connection token cannot delete a user Device', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'DELETE',
            auth: { bearer: connectionToken },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Only the Device creator can delete this Device');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/device/:device - connection token', async () => {
    try {
        const res = await flight.fetch(`/api/core/device/${machineDeviceId}`, {
            method: 'DELETE',
            auth: { bearer: connectionToken },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Core Device Deleted',
        });

        const get = await flight.fetch(`/api/core/device/${machineDeviceId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(get.status, 404);
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

test('DELETE: api/core/event/:event - a Device with an Effect survives event delete', async () => {
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
                channels: [7],
            },
        }, true);

        eventId = event.body.id;

        const effect = await flight.fetch(`/api/core/event/${eventId}/effect`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                device: deviceId,
                action: 'monitor',
            },
        }, true);

        assert.equal(effect.body.device, deviceId);

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

        assert.equal(res.body.id, deviceId);
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
