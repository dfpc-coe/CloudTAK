import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

let id = '';

test('GET: api/import', async () => {
    try {
        const res = await flight.fetch('/api/import', {
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

test('POST: api/import', async () => {
    try {
        const res = await flight.fetch('/api/import', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'test.zip'
            }
        }, true);

        assert.ok(res.body.id, 'has id');
        id = res.body.id;

        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        assert.deepEqual(res.body, {
            id: id,
            created: '2025-09-12T00:12:46.016Z',
            updated: '2025-09-12T00:12:46.016Z',
            name: 'test.zip',
            status: 'Empty',
            error: null,
            result: {},
            username: 'admin@example.com',
            source: 'Upload',
            source_id: null,
            config: {}
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test(`GET: api/import/<id>`, async () => {
    try {
        const res = await flight.fetch(`/api/import/${id}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.ok(res.body.id, 'has id');
        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        assert.deepEqual(res.body, {
            id: id,
            created: '2025-09-12T00:12:46.016Z',
            updated: '2025-09-12T00:12:46.016Z',
            name: 'test.zip',
            status: 'Empty',
            error: null,
            result: {},
            username: 'admin@example.com',
            source: 'Upload',
            source_id: null,
            config: {}
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test(`PATCH: api/import/<id>`, async () => {
    try {
        const res = await flight.fetch(`/api/import/${id}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                status: 'Running'
            }
        }, true);

        assert.ok(res.body.id, 'has id');
        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        assert.deepEqual(res.body, {
            id: id,
            created: '2025-09-12T00:12:46.016Z',
            updated: '2025-09-12T00:12:46.016Z',
            name: 'test.zip',
            status: 'Running',
            error: null,
            result: {},
            username: 'admin@example.com',
            source: 'Upload',
            source_id: null,
            config: {}
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test(`PATCH: api/import/<id> - Success`, async () => {
    try {
        const res = await flight.fetch(`/api/import/${id}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                status: 'Success'
            }
        }, true);

        assert.ok(res.body.id, 'has id');
        assert.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        assert.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        assert.deepEqual(res.body, {
            id: id,
            created: '2025-09-12T00:12:46.016Z',
            updated: '2025-09-12T00:12:46.016Z',
            name: 'test.zip',
            status: 'Success',
            error: null,
            result: {},
            username: 'admin@example.com',
            source: 'Upload',
            source_id: null,
            config: {}
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
