import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/fonts/Open Sans Regular/0-255.pbf', async () => {
    try {
        const res = await flight.fetch('/api/fonts/Open%20Sans%20Regular/0-255.pbf', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, {
            json: false,
            binary: true
        });

        assert.equal(res.status, 200);
        assert.ok(res.body.byteLength > 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/fonts/InvalidFont/0-255.pbf (fallback)', async () => {
    try {
        const res = await flight.fetch('/api/fonts/InvalidFont/0-255.pbf', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, {
            json: false,
            binary: true
        });

        assert.equal(res.status, 200);
        assert.ok(res.body.byteLength > 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/fonts/Open Sans Regular/999999-1000000.pbf (404)', async () => {
    try {
        const res = await flight.fetch('/api/fonts/Open%20Sans%20Regular/999999-1000000.pbf', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, {
            json: false,
            binary: true
        });

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});


test('GET: api/fonts/Open Sans Regular/0-255.pbf (401 - No Auth)', async () => {
    try {
        const res = await flight.fetch('/api/fonts/Open%20Sans%20Regular/0-255.pbf', {
            method: 'GET'
        }, {
            json: true
        });

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
