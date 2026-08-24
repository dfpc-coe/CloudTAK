import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

let formId: string;
let userFormId: string;

test('GET: api/core/form - empty', async () => {
    try {
        const res = await flight.fetch('/api/core/form', {
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

test('POST: api/core/form', async () => {
    try {
        const res = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Damage Assessment',
                description: 'Structure damage assessment form',
                schema: {
                    type: 'object',
                    required: ['severity'],
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
                channels: [7, 42],
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        formId = res.body.id;
        assert.ok(res.body.created, 'has created');
        assert.ok(res.body.updated, 'has updated');
        delete res.body.id;
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            username: 'admin@example.com',
            name: 'Damage Assessment',
            description: 'Structure damage assessment form',
            schema: {
                type: 'object',
                required: ['severity'],
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
            channels: [7, 42],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form/:form', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, formId);
        assert.equal(res.body.name, 'Damage Assessment');
        assert.deepEqual(res.body.channels, [7, 42]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form - filter by shared channel', async () => {
    try {
        const res = await flight.fetch('/api/core/form?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, formId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form - filter by unshared channel', async () => {
    try {
        const res = await flight.fetch('/api/core/form?channel=13', {
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

test('GET: api/core/form - hidden from user without channel access', async () => {
    try {
        const res = await flight.fetch('/api/core/form', {
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

test('GET: api/core/form/:form - 403 for user without channel access', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}`, {
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

test('POST: api/core/form - author sees their own Form', async () => {
    try {
        const res = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                name: 'Personal Checklist',
                schema: { type: 'object' },
            },
        }, true);

        userFormId = res.body.id;
        assert.equal(res.body.username, 'user@example.com');
        assert.equal(res.body.description, '', 'description defaults to an empty string');
        assert.deepEqual(res.body.channels, []);

        const list = await flight.fetch('/api/core/form', {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, true);

        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].id, userFormId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form - 403 for non-author', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                name: 'Sneaky Edit',
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Damage Assessment v2',
                schema: {
                    type: 'object',
                    properties: {
                        severity: { type: 'string' },
                    },
                },
            },
        }, true);

        assert.equal(res.body.name, 'Damage Assessment v2');
        assert.deepEqual(res.body.schema, {
            type: 'object',
            properties: {
                severity: { type: 'string' },
            },
        }, 'schema object is replaced, not merged');
        assert.deepEqual(res.body.channels, [7, 42], 'sharing is preserved');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form - replace channels', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                channels: [1],
            },
        }, true);

        assert.deepEqual(res.body.channels, [1]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form - clear channels', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}`, {
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

test('DELETE: api/core/form/:form - 403 for non-author', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}`, {
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

test('DELETE: api/core/form/:form', async () => {
    try {
        const res = await flight.fetch(`/api/core/form/${formId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Core Form Deleted',
        });

        const get = await flight.fetch(`/api/core/form/${formId}`, {
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
