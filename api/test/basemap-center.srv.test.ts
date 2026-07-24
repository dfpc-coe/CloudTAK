import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('POST: api/basemap - TileJSON [lon, lat, zoom] center is stored in full', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Hosted Tileset Basemap',
                url: 'https://tiles.example.com/tiles/public/snapping/tiles/{z}/{x}/{y}',
                protocol: 'zxy',
                type: 'vector',
                format: 'mvt',
                overlay: true,
                minzoom: 0,
                maxzoom: 14,
                bounds: [-180, -90, 180, 90],
                center: [-105.1, 39.7, 14],
            },
        }, true);

        assert.deepEqual(res.body.center, [-105.1, 39.7, 14]);
        assert.deepEqual(res.body.bounds, [-180, -90, 180, 90]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1/tiles - stored center zoom is passed through to TileJSON', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.center, [-105.1, 39.7, 14]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/basemap - 2 element center is stored as-is', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: '2D Center Basemap',
                url: 'https://tiles.example.com/2d/{z}/{x}/{y}',
                protocol: 'zxy',
                center: [12.5, 41.9],
            },
        }, true);

        assert.deepEqual(res.body.center, [12.5, 41.9]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/2/tiles - TileJSON center zoom is computed when not stored', async () => {
    try {
        const res = await flight.fetch('/api/basemap/2/tiles', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.center, [12.5, 41.9, 8]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/basemap - center with fewer than 2 elements is rejected', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Invalid Center Basemap',
                url: 'https://tiles.example.com/invalid/{z}/{x}/{y}',
                protocol: 'zxy',
                center: [12.5],
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/basemap - center with more than 3 elements is rejected', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Invalid Center Basemap',
                url: 'https://tiles.example.com/invalid/{z}/{x}/{y}',
                protocol: 'zxy',
                center: [12.5, 41.9, 8, 4],
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/1 - TileJSON [lon, lat, zoom] center is stored in full', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                center: [8.5, 47.4, 11],
            },
        }, true);

        assert.deepEqual(res.body.center, [8.5, 47.4, 11]);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
