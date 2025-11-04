import test from 'tape';
import ws from 'ws';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

let id = '';

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

test(`PATCH: api/import/<id> - Success`, (t) => {
    const url = new URL(`ws://localhost:5001`);
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const con = new ws(url);

    con.on('open', async () => {
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
    });

    con.on('error', (err) => {
        t.error(err, 'no error');
    }).on('message', (data) => {
        t.deepEquals(JSON.parse(String(data)), {
            type: 'import',
            properties: {
                id: id,
                created: '2025-09-12T00:12:46.016Z',
                updated: '2025-09-12T00:12:46.016Z',
                name: 'test.zip',
                status: 'Success',
                error: null,
                result: {},
                username: 'admin@example.com',
                sourcr: 'Upload',
                source_id: null,
                config: {}
            }
        });

        t.end();
    })
});

flight.landing();
