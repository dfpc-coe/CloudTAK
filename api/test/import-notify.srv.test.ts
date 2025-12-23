import test from 'node:test';
import assert from 'node:assert';
import ws from 'ws';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

let id = '';

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

test(`PATCH: api/import/<id> - Success`, async () => {
    const url = new URL(`ws://localhost:5001`);
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const conn = new ws(url);

    await new Promise<void>((resolve, reject) => {
        conn.on('open', async () => {
            try {
                // Wait 1 second
                await new Promise((resolve) => setTimeout(resolve, 1000));

                await flight.fetch(`/api/import/${id}`, {
                    method: 'PATCH',
                    auth: {
                        bearer: flight.token.admin
                    },
                    body: {
                        status: 'Success'
                    }
                }, true);
            } catch (err) {
                reject(err);
            }
        }).on('error', (err) => {
            reject(err);
        }).on('message', (data) => {
            try {
                const res = JSON.parse(String(data));

                assert.ok(res.properties.created, 'has created');
                res.properties.created = '2025-09-12T00:12:46.016Z';
                assert.ok(res.properties.updated, 'has updated');
                res.properties.updated = '2025-09-12T00:12:46.016Z';

                assert.deepEqual(res, {
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
                        source: 'Upload',
                        source_id: null,
                        config: {}
                    }
                });

                conn.close();
                resolve();
            } catch (err) {
                reject(err);
            }
        })
    });
});

flight.landing();
