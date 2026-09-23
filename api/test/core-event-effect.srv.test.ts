import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

/** Connection tokens are signed on their issue second - space out creations so they never collide */
const nextSecond = () => new Promise(resolve => setTimeout(resolve, 1100));

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });
flight.connection();

let eventId: string;
let deviceId: string;
let effectId: string;

const EVENT = {
    name: 'Wildfire Report',
    type: '10031000001213000000',
    geometry: {
        type: 'Point',
        coordinates: [-105.2705, 40.015],
    },
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
            body: {
                name: 'UAS-1',
                type: '10031000001213000000',
                manufacturer: 'DJI',
                model: 'Matrice 30',
            },
        }, true);

        deviceId = device.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event/effect - empty', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/effect`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { total: 0, items: [] });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/effect - unknown device', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/effect`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                device: '00000000-0000-0000-0000-000000000000',
                action: 'loiter',
            },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/effect', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/effect`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                device: deviceId,
                action: 'loiter',
                metadata: { radius: 200 },
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        effectId = res.body.id;
        assert.ok(res.body.created, 'has created');
        assert.ok(res.body.updated, 'has updated');
        assert.ok(res.body.started, 'has started');
        delete res.body.id;
        delete res.body.created;
        delete res.body.updated;
        delete res.body.started;

        assert.deepEqual(res.body, {
            ended: null,
            event: eventId,
            device: deviceId,
            action: 'loiter',
            status: 'tasked',
            metadata: { radius: 200 },
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event/effect - list & filter', async () => {
    try {
        await flight.fetch(`/api/core/event/${eventId}/effect`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                device: deviceId,
                action: 'navigate to',
                status: 'complete',
                ended: '2026-09-23T12:00:00.000Z',
            },
        }, true);

        const all = await flight.fetch(`/api/core/event/${eventId}/effect`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(all.body.total, 2);

        const tasked = await flight.fetch(`/api/core/event/${eventId}/effect?status=tasked`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(tasked.body.total, 1);
        assert.equal(tasked.body.items[0].action, 'loiter');

        const filtered = await flight.fetch(`/api/core/event/${eventId}/effect?filter=navigate`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(filtered.body.total, 1);
        assert.ok(String(filtered.body.items[0].ended).startsWith('2026-09-23'), 'has ended');

        const byDevice = await flight.fetch(`/api/core/event/${eventId}/effect?device=${deviceId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(byDevice.body.total, 2);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event/effect/:effect', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/effect/${effectId}`, {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: {
                status: 'active',
                metadata: { radius: 500 },
            },
        }, true);

        assert.equal(res.body.status, 'active');
        assert.deepEqual(res.body.metadata, { radius: 500 });
        assert.equal(res.body.action, 'loiter');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event/effect/:effect - non-creator user without a shared channel', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/effect/${effectId}`, {
            method: 'GET',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'You do not have permission to access this Event');
    } catch (err) {
        assert.ifError(err);
    }
});

let eventOnlyToken: string;
let scopedToken: string;
let machineEventId: string;
let machineDeviceId: string;

test('POST: api/connection/1/token - event only & scoped tokens', async () => {
    try {
        const eventOnly = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Event Only',
                permissions: ['event:*', 'device:*'],
            },
        }, true);

        eventOnlyToken = eventOnly.body.token;

        await nextSecond();

        const scoped = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Event & Effect',
                permissions: ['event:*', 'device:*', 'effect:*'],
            },
        }, true);

        scopedToken = scoped.body.token;

        const machineEvent = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: { ...EVENT, name: 'Machine Event' },
        }, true);

        machineEventId = machineEvent.body.id;

        const machineDevice = await flight.fetch('/api/core/device', {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: {
                name: 'UAS-2',
                type: '10031000001213000000',
            },
        }, true);

        machineDeviceId = machineDevice.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/effect - connection token needs the effect scope', async () => {
    try {
        const denied = await flight.fetch(`/api/core/event/${machineEventId}/effect`, {
            method: 'POST',
            auth: { bearer: eventOnlyToken },
            body: { device: machineDeviceId, action: 'loiter' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Connection token does not have the effect:create permission');

        const list = await flight.fetch(`/api/core/event/${machineEventId}/effect`, {
            method: 'GET',
            auth: { bearer: eventOnlyToken },
        }, false);

        assert.equal(list.status, 403);
        assert.equal(list.body.message, 'Connection token does not have the effect:read permission');

        const res = await flight.fetch(`/api/core/event/${machineEventId}/effect`, {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: { device: machineDeviceId, action: 'loiter' },
        }, true);

        assert.equal(res.body.event, machineEventId);
        assert.equal(res.body.device, machineDeviceId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/effect - effect scope alone is not enough', async () => {
    try {
        await nextSecond();

        const effectOnly = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Effect Only',
                permissions: ['effect:*', 'event:read'],
            },
        }, true);

        const denied = await flight.fetch(`/api/core/event/${machineEventId}/effect`, {
            method: 'POST',
            auth: { bearer: effectOnly.body.token },
            body: { device: machineDeviceId, action: 'loiter' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Connection token does not have the event:update permission');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/effect - connection token cannot task a Device it cannot access', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${machineEventId}/effect`, {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: { device: deviceId, action: 'loiter' },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'You do not have permission to access this Device');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/:event/effect/:effect', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/effect/${effectId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Effect Deleted' });

        const gone = await flight.fetch(`/api/core/event/${eventId}/effect/${effectId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(gone.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/device/:device - cascades Effects', async () => {
    try {
        await flight.fetch(`/api/core/device/${deviceId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        const remaining = await flight.fetch(`/api/core/event/${eventId}/effect`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(remaining.body.total, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
