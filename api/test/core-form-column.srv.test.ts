import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

let columnId: string;
let formId: string;
let unsharedFormId: string;
let attachmentId: string;

test('GET: api/board/column - auto-creates the Nominated Column', async () => {
    try {
        const boards = await flight.fetch('/api/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const res = await flight.fetch(`/api/board/column?board=${boards.body.items[0].id}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        columnId = res.body.items[0].id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/core/form - shared & unshared Forms', async () => {
    try {
        const shared = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Damage Assessment',
                schema: { type: 'object' },
                channels: [7],
            },
        }, true);

        formId = shared.body.id;

        const unshared = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Private Form',
                schema: { type: 'object' },
            },
        }, true);

        unsharedFormId = unshared.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/board/column/:column/form - empty', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
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

test('PUT: api/board/column/:column/form', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                form: formId,
                required: true,
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        attachmentId = res.body.id;
        assert.equal(res.body.column, columnId);
        assert.equal(res.body.required, true);
        assert.equal(res.body.form.id, formId);
        assert.equal(res.body.form.name, 'Damage Assessment');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/board/column/:column/form - upsert updates required', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                form: formId,
                required: false,
            },
        }, true);

        assert.equal(res.body.id, attachmentId, 'existing attachment is updated, not duplicated');
        assert.equal(res.body.required, false);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/board/column/:column/form - 400 for unshared Form', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                form: unsharedFormId,
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/board/column/:column/form - 404 for nonexistent Form', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                form: '00000000-0000-0000-0000-000000000000',
            },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/board/column/:column/form', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, attachmentId);
        assert.equal(res.body.items[0].form.id, formId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/board/column/:column/form - 403 without the Channel active', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
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

test('PUT: api/board/column/:column/form - 403 without the Channel active', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                form: formId,
            },
        }, false);

        assert.equal(res.status, 403);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/core/form/:form - attachment removed with the Form', async () => {
    try {
        const second = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Short Lived Form',
                schema: { type: 'object' },
                channels: [7],
            },
        }, true);

        await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                form: second.body.id,
            },
        }, true);

        await flight.fetch(`/api/core/form/${second.body.id}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        const res = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1, 'only the surviving attachment remains');
        assert.equal(res.body.items[0].form.id, formId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/board/column/:column/form/:form - 404 for unattached Form', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form/${unsharedFormId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/board/column/:column/form/:form', async () => {
    try {
        const res = await flight.fetch(`/api/board/column/${columnId}/form/${formId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Form detached from Column',
        });

        const list = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(list.body, {
            total: 0,
            items: [],
        });

        const form = await flight.fetch(`/api/core/form/${formId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(form.body.id, formId, 'the Form itself survives detach');
    } catch (err) {
        assert.ifError(err);
    }
});

let eventId: string;
let placementId: string;
let secondColumnId: string;
let secondFormId: string;
let boardId: string;

test('PUT: api/board/event - 400 when a required Form is missing', async () => {
    try {
        const attach = await flight.fetch(`/api/board/column/${columnId}/form`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                form: formId,
                required: true,
            },
        }, true);

        assert.equal(attach.body.required, true);

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
                channels: [7],
            },
        }, true);

        eventId = event.body.id;

        const res = await flight.fetch('/api/board/event', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: columnId,
                event: eventId,
                position: 0,
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(res.body.message.includes('Damage Assessment'), 'error names the missing Form');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/board/event - allowed once the required Form is completed', async () => {
    try {
        await flight.fetch(`/api/core/form/${formId}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {},
                events: [eventId],
            },
        }, true);

        const res = await flight.fetch('/api/board/event', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: columnId,
                event: eventId,
                position: 0,
            },
        }, true);

        placementId = res.body.id;
        assert.equal(res.body.column, columnId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/board/event/:placement - 400 moving into a Column with a missing required Form', async () => {
    try {
        const boards = await flight.fetch('/api/board?channel=7', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        boardId = boards.body.items[0].id;

        const column = await flight.fetch('/api/board/column', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                board: boardId,
                name: 'Reviewed',
            },
        }, true);

        secondColumnId = column.body.id;

        const form = await flight.fetch('/api/core/form', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Review Checklist',
                schema: { type: 'object' },
                channels: [7],
            },
        }, true);

        secondFormId = form.body.id;

        await flight.fetch(`/api/board/column/${secondColumnId}/form`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                form: secondFormId,
                required: true,
            },
        }, true);

        const res = await flight.fetch(`/api/board/event/${placementId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: secondColumnId,
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(res.body.message.includes('Review Checklist'), 'error names the missing Form');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/board/event/:placement - reorder within the Column stays possible', async () => {
    try {
        const res = await flight.fetch(`/api/board/event/${placementId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                position: 3,
            },
        }, true);

        assert.equal(res.body.position, 3);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/board/event/:placement - allowed once the required Form is completed', async () => {
    try {
        await flight.fetch(`/api/core/form/${secondFormId}/response`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                response: {},
                events: [eventId],
            },
        }, true);

        const res = await flight.fetch(`/api/board/event/${placementId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                column: secondColumnId,
            },
        }, true);

        assert.equal(res.body.column, secondColumnId);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
