import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'crsuser', admin: false });

test('GET api/config/coordinate-systems', async () => {
    try {
        const res = await flight.fetch('/api/config/coordinate-systems', {
            method: 'GET',
            auth: {
                bearer: flight.token.crsuser,
            },
        }, false);

        assert.equal(res.body.crs.length, 1);
        assert.equal(res.body.crs[0].name, 'NZTM');
        assert.equal(res.body.crs[0].epsg, 2193);
        assert.ok(res.body.crs[0].proj4);
        assert.deepEqual(res.body.crs[0].bounds, {
            minLongitude: 160.6,
            minLatitude: -55.95,
            maxLongitude: -171.2,
            maxLatitude: -25.88,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH api/profile - accepts a configured coordinate system', async () => {
    try {
        const res = await flight.fetch('/api/profile', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.crsuser,
            },
            body: {
                display_coordinate: 'NZTM',
            },
        }, false);

        assert.equal(res.body.display_coordinate, 'NZTM');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH api/profile - rejects an unknown coordinate system', async () => {
    try {
        const res = await flight.fetch('/api/profile', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.crsuser,
            },
            body: {
                display_coordinate: 'BNG',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.match(JSON.stringify(res.body), /Unknown coordinate format: BNG/);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT api/config - admin can default to a configured coordinate system', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'display::coordinate': 'NZTM',
            },
        }, false);

        assert.equal(res.body['display::coordinate'], 'NZTM');

        const defaults = await flight.fetch('/api/config/display', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(defaults.body.coordinate.value, 'NZTM');
        assert.ok(defaults.body.coordinate.options.includes('NZTM'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT api/config - rejects an unknown coordinate system default', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'display::coordinate': 'BNG',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.match(JSON.stringify(res.body), /Unknown coordinate format: BNG/);
    } catch (err) {
        assert.ifError(err);
    }
});
