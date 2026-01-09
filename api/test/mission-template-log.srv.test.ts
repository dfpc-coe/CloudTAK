import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const validIcon = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

let templateId: string;
let logId: string;

test('POST: /template/mission - create parent template', async () => {
    try {
        const res = await flight.fetch('/api/template/mission', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Parent Template',
                description: 'Parent template for logs',
                icon: validIcon
            }
        }, true);

        templateId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/log - empty', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/log`, {
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

test('POST: /template/mission/:mission/log - create', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/log`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Log',
                description: 'A test mission template log',
                icon: validIcon,
                schema: {
                    type: 'object',
                    properties: {
                        field1: { type: 'string' }
                    }
                }
            }
        }, true);

        assert.ok(res.body.id, 'returned an id');
        assert.equal(res.body.name, 'Test Log');
        assert.equal(res.body.description, 'A test mission template log');
        assert.equal(res.body.icon, validIcon);
        assert.deepEqual(res.body.schema, {
            type: 'object',
            properties: {
                field1: { type: 'string' }
            }
        });
        assert.ok(res.body.created, 'returned a created date');
        assert.ok(res.body.updated, 'returned an updated date');

        logId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/log - list', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/log`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.items[0].id, logId);
        assert.equal(res.body.items[0].name, 'Test Log');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/log/:log - get', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/log/${logId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.id, logId);
        assert.equal(res.body.name, 'Test Log');
        assert.equal(res.body.description, 'A test mission template log');
        assert.equal(res.body.icon, validIcon);
        assert.deepEqual(res.body.schema, {
            type: 'object',
            properties: {
                field1: { type: 'string' }
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: /template/mission/:mission/log/:log - update', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/log/${logId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Updated Log',
                description: 'An updated description',
                schema: {
                    type: 'object',
                    properties: {
                        field1: { type: 'number' }
                    }
                }
            }
        }, true);

        assert.equal(res.body.id, logId);
        assert.equal(res.body.name, 'Updated Log');
        assert.equal(res.body.description, 'An updated description');
        assert.equal(res.body.icon, validIcon);
        assert.deepEqual(res.body.schema, {
            type: 'object',
            properties: {
                field1: { type: 'number' }
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: /template/mission/:mission/log/:log - delete', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/log/${logId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.status, 200);
        assert.equal(res.body.message, 'Mission Template Log Deleted');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /template/mission/:mission/log/:log - not found', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}/log/${logId}`, {
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

test('DELETE: /template/mission/:mission - delete parent template', async () => {
    try {
        const res = await flight.fetch(`/api/template/mission/${templateId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.status, 200);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
