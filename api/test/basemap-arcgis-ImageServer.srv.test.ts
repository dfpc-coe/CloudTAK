import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

const ARCGIS_IMAGERY_URL = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer';

const SAMPLE_TILES = [
    { label: 'Mid-Atlantic seaboard', z: 5, x: 9, y: 12 },
    { label: 'Sierra Nevada ridge', z: 6, x: 11, y: 24 },
    { label: 'Central Midwest', z: 7, x: 32, y: 48 },
    { label: 'Kentucky foothills', z: 8, x: 66, y: 98 }
];

flight.init();
flight.takeoff();
flight.user();

test('POST: api/basemap - ArcGIS Imagery Source', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'USGS NAIP Imagery',
                url: ARCGIS_IMAGERY_URL,
                sharing_enabled: false
            }
        }, true);

        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            name: 'USGS NAIP Imagery',
            actions: { feature: [] },
            url: ARCGIS_IMAGERY_URL,
            overlay: false,
            iconset: '',
            title: 'callsign',
            username: 'admin@example.com',
            attribution: '',
            frequency: null,
            sharing_enabled: false,
            sharing_token: null,
            collection: null,
            tilesize: 256,
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            scheme: 'xyz',
            styles: [],
            type: 'raster'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1/tiles - ArcGIS Imagery TileJSON', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            tilejson: '3.0.0',
            version: '1.0.0',
            description: '',
            scheme: 'xyz',
            name: 'USGS NAIP Imagery',
            type: 'raster',
            bounds: [ -180, -90, 180, 90 ],
            center: [ 0, 0 ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 16,
            actions: { feature: [] },
            tiles: [ 'http://localhost:5001/api/basemap/1/tiles/{z}/{x}/{y}' ],
            vector_layers: [{ id: 'out', fields: {} }]
        });
    } catch (err) {
        assert.ifError(err);
    }
});

for (const { label, z, x, y } of SAMPLE_TILES) {
    test(`GET: api/basemap/1/tiles/${z}/${x}/${y} - ${label}`, async () => {
        try {
            const res = await flight.fetch(`/api/basemap/1/tiles/${z}/${x}/${y}`, {
                method: 'GET',
                auth: {
                    bearer: flight.token.admin
                }
            }, {
                verify: false,
                json: false
            });

            assert.equal(res.status, 200);
            assert.equal(res.headers.get('content-type'), 'image/jpeg');
            assert.ok(res.body.length > 0, 'tile payload received');
        } catch (err) {
            assert.ifError(err);
        }
    });
}

flight.landing();
