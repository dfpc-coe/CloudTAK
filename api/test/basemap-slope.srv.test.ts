import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const LEGEND = [
    { label: '27-30°', color: 'rgba(255, 235, 59, 0.78)' },
    { label: '30-35°', color: 'rgba(255, 152, 0, 0.78)' },
    { label: '35-45°', color: 'rgba(244, 67, 54, 0.78)' },
    { label: '45-50°', color: 'rgba(156, 39, 176, 0.78)' },
    { label: '50°+', color: 'rgba(33, 33, 33, 0.78)' },
];

test('POST: api/basemap - slope protocol keeps its DEM encoding', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Avalanche Slope Angle',
                url: 'https://tiles.mapterhorn.com/{$z}/{$x}/{$y}.webp',
                // Source TileJSON describes the DEM, not the rendered slope tiles
                tilejson: 'https://tiles.mapterhorn.com/tilejson.json',
                protocol: 'slope',
                type: 'raster',
                encoding: 'terrarium',
                tilesize: 512,
                overlay: true,
            },
        }, true);

        assert.equal(res.body.protocol, 'slope');
        assert.equal(res.body.type, 'raster');
        assert.equal(res.body.encoding, 'terrarium');

        const patched = await flight.fetch(`/api/basemap/${res.body.id}`, {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { encoding: 'mapbox' },
        }, true);

        assert.equal(patched.body.encoding, 'mapbox');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1/tiles - slope TileJSON points at the API and carries a legend', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.type, 'raster');
        assert.equal(res.body.tiles.length, 1);
        assert.ok(res.body.tiles[0].includes('/api/basemap/1/tiles/{z}/{x}/{y}'), res.body.tiles[0]);
        assert.deepEqual(res.body.legend, LEGEND);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/overlay - slope overlay TileJSON keeps its legend', async () => {
    try {
        await flight.fetch('/api/profile/overlay', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Avalanche Slope Angle',
                mode: 'overlay',
                mode_id: '1',
                url: '/api/basemap/1/tiles',
            },
        }, true);

        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        const overlay = res.body.items.find((item: { name: string }) => item.name === 'Avalanche Slope Angle');
        assert.ok(overlay);
        assert.deepEqual(overlay.tilejson.legend, LEGEND);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
