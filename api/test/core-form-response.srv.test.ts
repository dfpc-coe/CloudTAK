import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

let formId: string;
let secondFormId: string;
let eventId: string;
let responseId: string;
let linkedResponseId: string;

test('POST: api/core/form - 400 for invalid schema', async () => {
    try {
        const res = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Broken Form',
                schema: {
                    type: 123,
                },
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/form', async () => {
    try {
        const res = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Damage Assessment',
                schema: {
                    type: 'object',
                    required: ['severity'],
                    additionalProperties: false,
                    properties: {
                        severity: {
                            type: 'string',
                            enum: ['Minor', 'Major', 'Destroyed'],
                        },
                        notes: {
                            type: 'string',
                        },
                    },
                },
            },
        }, true);

        formId = res.body.id;

        const second = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Second Form',
                schema: { type: 'object' },
            },
        }, true);

        secondFormId = second.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form/:form/response - empty', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
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

test('POST: api/core/form/:form/response', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {
                    severity: 'Major',
                    notes: 'Roof collapse on the east wing',
                },
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        responseId = res.body.id;
        assert.ok(res.body.created, 'has created');
        assert.ok(res.body.updated, 'has updated');
        delete res.body.id;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            form: formId,
            username: 'admin@example.com',
            response: {
                severity: 'Major',
                notes: 'Roof collapse on the east wing',
            },
            events: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/form/:form/response - 400 for missing required field', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {
                    notes: 'No severity given',
                },
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/form/:form/response - 400 for invalid enum value', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {
                    severity: 'Catastrophic',
                },
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/form/:form/response - linked to an Event', async () => {
    try {
        const event = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Structure Fire',
                type: '10031000001213000000',
                geometry: {
                    type: 'Point',
                    coordinates: [-105.2705, 40.015],
                },
            },
        }, true);

        eventId = event.body.id;

        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {
                    severity: 'Destroyed',
                },
                events: [eventId],
            },
        }, true);

        linkedResponseId = res.body.id;
        assert.deepEqual(res.body.events, [eventId]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/form/:form/response - 404 for nonexistent event', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {
                    severity: 'Minor',
                },
                events: ['00000000-0000-0000-0000-000000000000'],
            },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form/:form/response - filter by event', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 2);

        const filtered = await flight.fetch(`/api/core/form/${formId}/response?event=${eventId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(filtered.body.total, 1);
        assert.equal(filtered.body.items[0].id, linkedResponseId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form/:form/response/:response', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response/${responseId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, responseId);
        assert.equal(res.body.form, formId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form/:form/response/:response - 404 for Response of another Form', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${secondFormId}/response/${responseId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form/:form/response - 403 for user without Form access', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
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

test('POST: api/core/form/:form/response - 403 for user without Form access', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                response: {
                    severity: 'Minor',
                },
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form/response/:response', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response/${responseId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {
                    severity: 'Minor',
                },
            },
        }, true);

        assert.deepEqual(res.body.response, {
            severity: 'Minor',
        }, 'response data is replaced, not merged');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form/response/:response - 400 for invalid data', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response/${responseId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {
                    severity: 'Minor',
                    unexpected: true,
                },
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form/response/:response - replace events', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response/${responseId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                events: [eventId],
            },
        }, true);

        assert.deepEqual(res.body.events, [eventId]);

        const cleared = await flight.fetch(`/api/core/form/${formId}/response/${responseId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                events: [],
            },
        }, true);

        assert.deepEqual(cleared.body.events, []);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/event/:event - linked Response survives Event delete', async () => {
    try {
        await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const res = await flight.fetch(`/api/core/form/${formId}/response/${linkedResponseId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.events, [], 'link removed by cascade');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/form/:form/response/:response - 403 for user without Form access', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response/${responseId}`, {
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

test('DELETE: api/core/form/:form/response/:response', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}/response/${responseId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Form Response Deleted',
        });

        const get = await flight.fetch(`/api/core/form/${formId}/response/${responseId}`, {
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

test('DELETE: api/core/form/:form - Responses removed with the Form', async () => {
    try {
        await flight.fetch(`/api/core/form/${formId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const res = await flight.fetch(`/api/core/form/${formId}/response/${linkedResponseId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

let linkedEventId: string;

test('GET: api/core/event/:event/response - linked Responses with embedded Form', async () => {
    try {
        const form = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'After Action Review',
                schema: { type: 'object' },
            },
        }, true);

        const event = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Flood Response',
                type: '10031000001213000000',
                geometry: {
                    type: 'Point',
                    coordinates: [-105.2705, 40.015],
                },
            },
        }, true);

        linkedEventId = event.body.id;

        const linked = await flight.fetch(`/api/core/form/${form.body.id}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: { status: 'complete' },
                events: [linkedEventId],
            },
        }, true);

        // A Response not linked to the Event must not appear
        await flight.fetch(`/api/core/form/${form.body.id}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: { status: 'unlinked' },
            },
        }, true);

        const res = await flight.fetch(`/api/core/event/${linkedEventId}/response`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, linked.body.id);
        assert.equal(res.body.items[0].username, 'admin@example.com');
        assert.deepEqual(res.body.items[0].response, { status: 'complete' });
        assert.equal(res.body.items[0].form.id, form.body.id);
        assert.equal(res.body.items[0].form.name, 'After Action Review');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/event/:event/response - 403 for user without Event access', async () => {
    try {
        const res = await flight.fetch(`/api/core/event/${linkedEventId}/response`, {
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

flight.landing();
