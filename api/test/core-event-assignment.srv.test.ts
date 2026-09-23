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
flight.connection();

let eventId: string;
let assignmentId: string;

const EVENT = {
    name: 'Wildfire Report',
    type: '10031000001213000000',
    geometry: {
        type: 'Point',
        coordinates: [-105.2705, 40.015],
    },
};

test('POST: api/core/event - admin', async () => {
    try {
        const res = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: EVENT,
        }, true);

        eventId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event/assignment - empty', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { total: 0, items: [] });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/assignment - unknown profile', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Nobody',
                uid: 'nobody@example.com',
            },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/assignment', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Jane Doe',
                uid: 'user@example.com',
                role: 'IC',
                remarks: 'Incident Commander',
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        assignmentId = res.body.id;
        assert.ok(res.body.created, 'has created');
        assert.ok(res.body.updated, 'has updated');
        delete res.body.id;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            event: eventId,
            uid: 'user@example.com',
            name: 'Jane Doe',
            role: 'IC',
            remarks: 'Incident Commander',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/assignment - duplicate profile', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Jane Doe Again',
                uid: 'user@example.com',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Profile is already assigned to this Event');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/assignment - unlinked person', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment`, {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'John Smith',
                role: 'JAG',
            },
        }, true);

        assert.equal(res.body.uid, null);
        assert.equal(res.body.role, 'JAG');
        assert.equal(res.body.remarks, '');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event/assignment - list & filter', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.total, 2);

        const filtered = await flight.fetch(`/api/core/event/${eventId}/assignment?filter=jane`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(filtered.body.total, 1);
        assert.equal(filtered.body.items[0].name, 'Jane Doe');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event/assignment/:assignment', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment/${assignmentId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.id, assignmentId);
        assert.equal(res.body.name, 'Jane Doe');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event/assignment/:assignment - assigned user can read a shared Event', async () => {
    try {
        const denied = await flight.fetch(`/api/core/event/${eventId}/assignment/${assignmentId}`, {
            method: 'GET',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'You do not have permission to access this Event');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/event/:event/assignment/:assignment', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment/${assignmentId}`, {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: {
                role: 'Deputy IC',
                uid: null,
            },
        }, true);

        assert.equal(res.body.role, 'Deputy IC');
        assert.equal(res.body.uid, null);
        assert.equal(res.body.name, 'Jane Doe');
    } catch (err) {
        assert.ifError(err);
    }
});

let otherEventId: string;

test('GET: api/core/event/:event/assignment/:assignment - 404 for another Event', async () => {
    try {
        const other = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: { ...EVENT, name: 'Other Event' },
        }, true);

        otherEventId = other.body.id;

        const res = await flight.fetch(`/api/core/event/${otherEventId}/assignment/${assignmentId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(res.status, 404);
        assert.equal(res.body.message, 'Assignment does not belong to this Event');
    } catch (err) {
        assert.ifError(err);
    }
});

let eventOnlyToken: string;
let scopedToken: string;
let machineEventId: string;

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
                name: 'Event & Assignment',
                permissions: ['event:*', 'assignment:*'],
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

test('POST: api/core/event/:event/assignment - connection token needs the assignment scope', async () => {
    try {
        const denied = await flight.fetch(`/api/core/event/${machineEventId}/assignment`, {
            method: 'POST',
            auth: { bearer: eventOnlyToken },
            body: { name: 'Machine IC' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Connection token does not have the assignment:create permission');

        const list = await flight.fetch(`/api/core/event/${machineEventId}/assignment`, {
            method: 'GET',
            auth: { bearer: eventOnlyToken },
        }, false);

        assert.equal(list.status, 403);
        assert.equal(list.body.message, 'Connection token does not have the assignment:read permission');

        const res = await flight.fetch(`/api/core/event/${machineEventId}/assignment`, {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: { name: 'Machine IC', role: 'IC' },
        }, true);

        assert.equal(res.body.event, machineEventId);
        assert.equal(res.body.name, 'Machine IC');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/assignment - assignment scope alone is not enough', async () => {
    try {
        await nextSecond();

        const assignmentOnly = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Assignment Only',
                permissions: ['assignment:*', 'event:read'],
            },
        }, true);

        const denied = await flight.fetch(`/api/core/event/${machineEventId}/assignment`, {
            method: 'POST',
            auth: { bearer: assignmentOnly.body.token },
            body: { name: 'Machine IC' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Connection token does not have the event:update permission');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/assignment - layer token needs both scopes', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Event Only Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
            permissions: ['event:update'],
        });

        await flight.config!.models.Layer.generate({
            name: 'Scoped Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
            permissions: ['event:update', 'assignment:create'],
        });

        const eventOnlyLayer = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');
        const scopedLayer = 'etl.' + jwt.sign({ access: 'layer', id: 2, internal: true }, 'coe-wildland-fire');

        const denied = await flight.fetch(`/api/core/event/${machineEventId}/assignment`, {
            method: 'POST',
            auth: { bearer: eventOnlyLayer },
            body: { name: 'Layer IC' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Layer token does not have the assignment:create permission');

        const res = await flight.fetch(`/api/core/event/${machineEventId}/assignment`, {
            method: 'POST',
            auth: { bearer: scopedLayer },
            body: { name: 'Layer IC' },
        }, true);

        assert.equal(res.body.name, 'Layer IC');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/event/:event/assignment - connection token cannot reach an unshared Event', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment`, {
            method: 'POST',
            auth: { bearer: scopedToken },
            body: { name: 'Intruder' },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'You do not have permission to access this Event');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/:event/assignment/:assignment', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${eventId}/assignment/${assignmentId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Assignment Deleted' });

        const gone = await flight.fetch(`/api/core/event/${eventId}/assignment/${assignmentId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(gone.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/:event - cascades Assignments', async () => {
    try {
        await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        const remaining = await flight.config!.models.CoreEventAssignment.list();
        assert.ok(remaining.items.every(a => a.event !== eventId));
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
