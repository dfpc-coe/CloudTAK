import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const validIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

test('GET: /template/mission - empty', async () => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

let templateId: string;

test('POST: /template/mission - create', async () => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Template',
                description: 'A test mission template',
                icon: validIcon
            }
        }, true);

        assert.ok(res.body.id, 'returned an id');
        assert.equal(res.body.name, 'Test Template');
        assert.equal(res.body.description, 'A test mission template');
        assert.equal(res.body.icon, validIcon);
        assert.ok(res.body.created, 'returned a created date');
        assert.ok(res.body.updated, 'returned an updated date');

        templateId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission - list', async () => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.items[0].id, templateId);
        assert.equal(res.body.items[0].name, 'Test Template');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission - get', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.id, templateId);
        assert.equal(res.body.name, 'Test Template');
        assert.equal(res.body.description, 'A test mission template');
        assert.equal(res.body.icon, validIcon);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: /template/mission/:mission - update', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Updated Template',
                description: 'An updated description'
            }
        }, true);

        assert.equal(res.body.id, templateId);
        assert.equal(res.body.name, 'Updated Template');
        assert.equal(res.body.description, 'An updated description');
        assert.equal(res.body.icon, validIcon);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: /template/mission/:mission - delete', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.status, 200);
        assert.equal(res.body.message, 'Mission Template Deleted');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission - not found', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
