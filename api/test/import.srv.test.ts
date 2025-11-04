import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

let id = '';

test('GET: api/import', async (t) => {
    try {
        const res = await flight.fetch('/api/import', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/import', async (t) => {
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

        t.ok(res.body.id, 'has id');
        id = res.body.id;

        t.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        t.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        t.deepEquals(res.body, {
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
        t.error(err, 'no error');
    }

    t.end();
});

test(`GET: api/import/<id>`, async (t) => {
    try {
        const res = await flight.fetch(`/api/import/${id}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.ok(res.body.id, 'has id');
        t.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        t.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        t.deepEquals(res.body, {
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
        t.error(err, 'no error');
    }

    t.end();
});

test(`PATCH: api/import/<id>`, async (t) => {
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

        t.ok(res.body.id, 'has id');
        t.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        t.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        t.deepEquals(res.body, {
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
        t.error(err, 'no error');
    }

    t.end();
});

test(`PATCH: api/import/<id> - Success`, async (t) => {
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

        t.ok(res.body.id, 'has id');
        t.ok(res.body.created, 'has created');
        res.body.created = '2025-09-12T00:12:46.016Z';
        t.ok(res.body.updated, 'has updated');
        res.body.updated = '2025-09-12T00:12:46.016Z';

        t.deepEquals(res.body, {
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
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
