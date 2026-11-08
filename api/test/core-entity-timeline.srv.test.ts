import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';

const flight = new Flight();

/** Connection tokens are signed on their issue second - space out creations so they never collide */
const nextSecond = () => new Promise(resolve => setTimeout(resolve, 1100));

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });
flight.integration('test-task');
flight.connection();

let eventId: string;
let deviceId: string;
let entryId: string;
let userEventId: string;
let userEntryId: string;
let adminEntryId: string;
let eventOnlyToken: string;
let scopedToken: string;
let machineEventId: string;

const EVENT = {
    name: 'Structure Fire',
    type: '10031000001213000000',
    geometry: {
        type: 'Point',
        coordinates: [-105.2705, 40.015],
    },
    channels: [7],
};

const DEVICE = {
    name: 'Backpack Detective',
    type: '10031000001213000000',
    manufacturer: 'Ortec',
    channels: [7],
};

test('POST: api/core/event & api/core/device - admin', async () => {
    try {
        const event = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: EVENT,
        }, true);

        eventId = event.body.id;

        const device = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: DEVICE,
        }, true);

        deviceId = device.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/entity/:entity/timeline - empty', async () => {
    try {
        const res = await flight.fetch(`/api/core/entity/${eventId}/timeline`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { total: 0, counts: { comment: 0, status: 0, unit: 0, location: 0, attachment: 0, external: 0 }, items: [] });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/entity/:entity/timeline - 404 for an unknown Entity', async () => {
    try {
        const res = await flight.fetch('/api/core/entity/00000000-0000-0000-0000-000000000000/timeline', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - comment defaults to the user', async () => {
    try {
        const res = await flight.fetch(`/api/core/entity/${eventId}/timeline`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                body: 'Engine 4 reports heavy smoke showing',
            },
        }, true);

        assert.ok(res.body.id);
        assert.ok(res.body.created);
        assert.ok(res.body.occurred);
        assert.equal(res.body.entity, eventId);
        assert.equal(res.body.type, 'comment');
        assert.equal(res.body.username, 'admin@example.com');
        assert.equal(res.body.author, 'admin@example.com');
        assert.equal(res.body.body, 'Engine 4 reports heavy smoke showing');
        assert.deepEqual(res.body.metadata, {});
        assert.equal(res.body.external_id, null);

        entryId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - typed entry with payload', async () => {
    try {
        const res = await flight.fetch(`/api/core/entity/${eventId}/timeline`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                type: 'unit',
                occurred: '2026-11-06T10:15:00.000Z',
                author: 'Dispatch',
                body: 'E4 En Route',
                metadata: { unit: 'E4', status: 'enroute' },
                external_id: 'cad-1',
            },
        }, true);

        assert.equal(res.body.type, 'unit');
        assert.ok(res.body.occurred.startsWith('2026-11-06'));
        assert.equal(res.body.username, 'admin@example.com');
        assert.equal(res.body.author, 'Dispatch');
        assert.deepEqual(res.body.metadata, { unit: 'E4', status: 'enroute' });
        assert.equal(res.body.external_id, 'cad-1');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - duplicate external_id', async () => {
    try {
        const res = await flight.fetch(`/api/core/entity/${eventId}/timeline`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                type: 'unit',
                body: 'E4 En Route again',
                external_id: 'cad-1',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'external_id is already used by another entry of this Entity');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - empty external_id is rejected', async () => {
    try {
        const res = await flight.fetch(`/api/core/entity/${eventId}/timeline`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                body: 'No key',
                external_id: '',
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/core/entity/:entity/timeline - upsert batch', async () => {
    try {
        const first = await flight.fetch(`/api/core/entity/${eventId}/timeline`, {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                entries: [{
                    type: 'unit',
                    author: 'Dispatch',
                    body: 'E4 On Scene',
                    metadata: { unit: 'E4', status: 'onscene' },
                    external_id: 'cad-1',
                }, {
                    type: 'unit',
                    author: 'Dispatch',
                    body: 'M7 Dispatched',
                    metadata: { unit: 'M7', status: 'dispatched' },
                    external_id: 'cad-2',
                }, {
                    body: 'Unkeyed note',
                }],
            },
        }, true);

        assert.equal(first.body.total, 3);
        const updated = first.body.items.find((i: { external_id: string | null }) => i.external_id === 'cad-1');
        assert.equal(updated.body, 'E4 On Scene');
        assert.deepEqual(updated.metadata, { unit: 'E4', status: 'onscene' });

        const again = await flight.fetch(`/api/core/entity/${eventId}/timeline`, {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                entries: [{
                    type: 'unit',
                    author: 'Dispatch',
                    body: 'M7 Dispatched',
                    metadata: { unit: 'M7', status: 'dispatched' },
                    external_id: 'cad-2',
                }],
            },
        }, true);

        assert.equal(again.body.total, 1);

        const list = await flight.fetch(`/api/core/entity/${eventId}/timeline?limit=100`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.total, 4);
        assert.equal(list.body.items.filter((i: { external_id: string | null }) => i.external_id === 'cad-1').length, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/entity/:entity/timeline - filter & type', async () => {
    try {
        const units = await flight.fetch(`/api/core/entity/${eventId}/timeline?type=unit`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(units.body.total, 2);
        assert.ok(units.body.items.every((i: { type: string }) => i.type === 'unit'));

        const smoke = await flight.fetch(`/api/core/entity/${eventId}/timeline?filter=smoke`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(smoke.body.total, 1);
        assert.equal(smoke.body.items[0].id, entryId);

        const byAuthor = await flight.fetch(`/api/core/entity/${eventId}/timeline?filter=dispatch`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(byAuthor.body.total, 2);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/entity/:entity/timeline/:entry', async () => {
    try {
        const res = await flight.fetch(`/api/core/entity/${eventId}/timeline/${entryId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.id, entryId);
        assert.equal(res.body.body, 'Engine 4 reports heavy smoke showing');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/entity/:entity/timeline/:entry - 404 for another Event', async () => {
    try {
        const other = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: { ...EVENT, name: 'Other Event' },
        }, true);

        const res = await flight.fetch(`/api/core/entity/${other.body.id}/timeline/${entryId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(res.status, 404);
        assert.equal(res.body.message, 'Entry does not belong to this Entity');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - user comments on their own Event', async () => {
    try {
        const event = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: flight.token.user },
            body: { ...EVENT, name: 'User Event' },
        }, true);

        userEventId = event.body.id;

        const res = await flight.fetch(`/api/core/entity/${userEventId}/timeline`, {
            method: 'POST',
            auth: { bearer: flight.token.user },
            body: { body: 'Command post established' },
        }, true);

        assert.equal(res.body.username, 'user@example.com');
        assert.equal(res.body.author, 'user@example.com');

        userEntryId = res.body.id;

        const admin = await flight.fetch(`/api/core/entity/${userEventId}/timeline`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: { body: 'Admin note' },
        }, true);

        adminEntryId = admin.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/entity/:entity/timeline/:entry - only the author or an admin', async () => {
    try {
        const denied = await flight.fetch(`/api/core/entity/${userEventId}/timeline/${adminEntryId}`, {
            method: 'PATCH',
            auth: { bearer: flight.token.user },
            body: { body: 'Tampered' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Only the author of a Timeline entry may change it');

        const own = await flight.fetch(`/api/core/entity/${userEventId}/timeline/${userEntryId}`, {
            method: 'PATCH',
            auth: { bearer: flight.token.user },
            body: { body: 'Command post established at the north gate' },
        }, true);

        assert.equal(own.body.body, 'Command post established at the north gate');
        assert.notEqual(own.body.updated, own.body.created);

        const admin = await flight.fetch(`/api/core/entity/${userEventId}/timeline/${userEntryId}`, {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { type: 'status', metadata: { status: 'command established' } },
        }, true);

        assert.equal(admin.body.type, 'status');
        assert.deepEqual(admin.body.metadata, { status: 'command established' });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/entity/:entity/timeline/:entry - only the author or an admin', async () => {
    try {
        const denied = await flight.fetch(`/api/core/entity/${userEventId}/timeline/${adminEntryId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(denied.status, 403);

        const res = await flight.fetch(`/api/core/entity/${userEventId}/timeline/${userEntryId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.user },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Timeline Entry Deleted' });

        const gone = await flight.fetch(`/api/core/entity/${userEventId}/timeline/${userEntryId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(gone.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - Device', async () => {
    try {
        const res = await flight.fetch(`/api/core/entity/${deviceId}/timeline`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                type: 'status',
                body: 'Calibrated against Cs-137 check source',
                metadata: { status: 'calibrated' },
            },
        }, true);

        assert.equal(res.body.entity, deviceId);
        assert.equal(res.body.type, 'status');

        const list = await flight.fetch(`/api/core/entity/${deviceId}/timeline`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.total, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/token - event only & scoped tokens', async () => {
    try {
        const eventOnly = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Event Only',
                permissions: ['event:*'],
            },
        }, true);

        eventOnlyToken = eventOnly.body.token;

        await nextSecond();

        const scoped = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Event & Timeline',
                permissions: ['event:*', 'timeline:*'],
            },
        }, true);

        scopedToken = scoped.body.token;

        const machine = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: { ...EVENT, name: 'Machine Event' },
        }, true);

        machineEventId = machine.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - connection token needs the timeline scope', async () => {
    try {
        const denied = await flight.fetch(`/api/core/entity/${machineEventId}/timeline`, {
            method: 'POST',
            auth: { bearer: eventOnlyToken },
            body: { body: 'Machine note' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Connection token does not have the timeline:create permission');

        const list = await flight.fetch(`/api/core/entity/${machineEventId}/timeline`, {
            method: 'GET',
            auth: { bearer: eventOnlyToken },
        }, false);

        assert.equal(list.status, 403);
        assert.equal(list.body.message, 'Connection token does not have the timeline:read permission');

        const res = await flight.fetch(`/api/core/entity/${machineEventId}/timeline`, {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: { author: 'CAD', body: 'Machine note', external_id: 'cad-9' },
        }, true);

        assert.equal(res.body.entity, machineEventId);
        assert.equal(res.body.username, null);
        assert.equal(res.body.author, 'CAD');

        const batch = await flight.fetch(`/api/core/entity/${machineEventId}/timeline`, {
            method: 'PUT',
            auth: { bearer: scopedToken },
            body: { entries: [{ author: 'CAD', body: 'Machine note updated', external_id: 'cad-9' }] },
        }, true);

        assert.equal(batch.body.items[0].id, res.body.id);
        assert.equal(batch.body.items[0].body, 'Machine note updated');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - layer token needs the timeline scope', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Event Only Layer',
            task: 1,
            version: '1.0.0',
            connection: 1,
            permissions: ['event:update'],
        });

        await flight.config!.models.Layer.generate({
            name: 'Scoped Layer',
            task: 1,
            version: '1.0.0',
            connection: 1,
            permissions: ['event:update', 'timeline:create'],
        });

        const eventOnlyLayer = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');
        const scopedLayer = 'etl.' + jwt.sign({ access: 'layer', id: 2, internal: true }, 'coe-wildland-fire');

        const denied = await flight.fetch(`/api/core/entity/${machineEventId}/timeline`, {
            method: 'POST',
            auth: { bearer: eventOnlyLayer },
            body: { body: 'Layer note' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Layer token does not have the timeline:create permission');

        const res = await flight.fetch(`/api/core/entity/${machineEventId}/timeline`, {
            method: 'POST',
            auth: { bearer: scopedLayer },
            body: { author: 'ETL', body: 'Layer note' },
        }, true);

        assert.equal(res.body.author, 'ETL');
        assert.equal(res.body.username, null);
        assert.deepEqual(res.body.layer, { id: 2, name: 'Scoped Layer' });

        const list = await flight.fetch(`/api/core/entity/${machineEventId}/timeline`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.items[0].layer, null);
        assert.deepEqual(list.body.items[1].layer, { id: 2, name: 'Scoped Layer' });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/entity/:entity/timeline - connection token cannot reach an unshared Event', async () => {
    try {
        const res = await flight.fetch(`/api/core/entity/${eventId}/timeline`, {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: { body: 'Intruder' },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'You do not have permission to access this Event');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/:event - cascades Timeline entries', async () => {
    try {
        await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        const remaining = await flight.config!.models.CoreEntityTimeline.list();
        assert.ok(remaining.items.every(e => e.entity !== eventId));
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
