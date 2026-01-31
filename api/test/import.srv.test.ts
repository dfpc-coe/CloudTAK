import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

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
            results: [],
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
            results: [],
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
            results: [],
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
            results: [],
            username: 'admin@example.com',
            source: 'Upload',
            source_id: null,
            config: {}
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/import/:import/result - Missing Auth', async () => {
    try {
        const res = await flight.fetch(`/api/import/${id}/result`, {
            method: 'POST',
            body: {
                name: 'Test Feature',
                type: 'Feature',
                type_id: 'feature-123'
            }
        }, false);

        assert.equal(res.status, 401, 'should return 401 for missing auth');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/import/:import/result - Wrong User', async () => {
    try {
        const res = await flight.fetch(`/api/import/${id}/result`, {
            method: 'POST',
            auth: {
                bearer: flight.token.user
            },
            body: {
                name: 'Test Feature',
                type: 'Feature',
                type_id: 'feature-123'
            }
        }, false);

        assert.equal(res.status, 400, 'should return 400 for wrong user');
        assert.equal(res.body.message, 'You did not create this import', 'should return appropriate error message');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/import/:import/result - Success', async () => {
    try {
        const res = await flight.fetch(`/api/import/${id}/result`, {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Feature',
                type: 'Feature',
                type_id: 'feature-123'
            }
        }, true);

        assert.ok(res.body.id, 'has id');
        assert.equal(res.body.import, id, 'has correct import id');
        assert.equal(res.body.name, 'Test Feature', 'has correct name');
        assert.equal(res.body.type, 'Feature', 'has correct type');
        assert.equal(res.body.type_id, 'feature-123', 'has correct type_id');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/import/:import - Verify Result Appears', async () => {
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

        assert.equal(res.body.results.length, 1, 'has one result');
        assert.ok(res.body.results[0].id, 'result has id');
        assert.equal(res.body.results[0].import, id, 'result has correct import id');
        assert.equal(res.body.results[0].name, 'Test Feature', 'result has correct name');
        assert.equal(res.body.results[0].type, 'Feature', 'result has correct type');
        assert.equal(res.body.results[0].type_id, 'feature-123', 'result has correct type_id');

        // Verify the rest of the import object
        assert.deepEqual({
            ...res.body,
            created: '2025-09-12T00:12:46.016Z',
            updated: '2025-09-12T00:12:46.016Z',
            results: [] // Clear results for comparison
        }, {
            id: id,
            created: '2025-09-12T00:12:46.016Z',
            updated: '2025-09-12T00:12:46.016Z',
            name: 'test.zip',
            status: 'Success',
            error: null,
            results: [],
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
