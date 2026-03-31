import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.connection();

const stale = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const fresh = new Date(Date.now() + 60 * 60 * 1000).toISOString();

test('PUT api/connection/1/feature - stale feature', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: 'stale-feature',
                type: 'Feature',
                path: '/Retention/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: stale,
                    start: stale,
                    stale: stale,
                    callsign: 'Stale Feature',
                    center: [1, 1],
                },
                geometry: {
                    type: 'Point',
                    coordinates: [1, 1]
                }
            }
        }, true);

        assert.equal(res.body.id, 'stale-feature');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT api/connection/1/feature - fresh feature', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: 'fresh-feature',
                type: 'Feature',
                path: '/Retention/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: fresh,
                    start: fresh,
                    stale: fresh,
                    callsign: 'Fresh Feature',
                    center: [2, 2],
                },
                geometry: {
                    type: 'Point',
                    coordinates: [2, 2]
                }
            }
        }, true);

        assert.equal(res.body.id, 'fresh-feature');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/retention - connection feature action', async () => {
    try {
        const res = await flight.fetch('/api/retention', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                action: 'connection-feature'
            }
        }, true);

        assert.equal(res.body.name, 'connection-feature');
        assert.equal(res.body.status, 'success');
        assert.equal(res.body.deleted, 1);
        assert.equal(typeof res.body.duration, 'number');
        assert.ok(res.body.duration >= 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/connection/1/feature - only fresh remains', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                id: 'fresh-feature',
                type: 'Feature',
                path: '/Retention/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: fresh,
                    start: fresh,
                    stale: fresh,
                    center: [2, 2],
                    callsign: 'Fresh Feature'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [2, 2, 0]
                }
            }]
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();