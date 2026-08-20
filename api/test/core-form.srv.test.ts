import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

let boardId: string;
let secondBoardId: string;
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

test('GET: api/board - auto-creates the Channel Board', async () => {
    try {
        const res = await flight.fetch('/api/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        boardId = res.body.items[0].id;
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
                boards: [boardId],
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
            boards: [boardId],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/form - 404 for nonexistent board', async () => {
    try {
        const res = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Orphan Form',
                schema: { type: 'object' },
                boards: ['00000000-0000-0000-0000-000000000000'],
            },
        }, false);

        assert.equal(res.status, 404);
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
        assert.deepEqual(res.body.boards, [boardId]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/core/form - filter by board', async () => {
    try {
        const res = await flight.fetch(`/api/core/form?board=${boardId}`, {
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
        assert.deepEqual(res.body.boards, []);

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
        const res = await flight.fetch(`/api/core/form/${userFormId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                boards: [boardId],
            },
        }, false);

        // The author may edit but attaching a Board they cannot access is refused
        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form - 403 for non-author edit', async () => {
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
        assert.deepEqual(res.body.boards, [boardId], 'board relations are preserved');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/core/form/:form - replace boards', async () => {
    try {
        const board = await flight.fetch('/api/board', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                channel: 7,
                name: 'Second Board',
            },
        }, true);

        secondBoardId = board.body.id;

        const res = await flight.fetch(`/api/core/form/${formId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                boards: [secondBoardId],
            },
        }, true);

        assert.deepEqual(res.body.boards, [secondBoardId]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/board/:board - related Form survives board delete', async () => {
    try {
        await flight.fetch(`/api/board/${secondBoardId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const res = await flight.fetch(`/api/core/form/${formId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.boards, [], 'board relation removed by cascade');
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
