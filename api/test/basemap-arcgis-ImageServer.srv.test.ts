import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

const ARCGIS_IMAGERY_URL = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer';
const JEFFERSON_COUNTY_IMAGERY_URL = 'https://jeffarcgis.jeffersoncountywi.gov/arcgis/rest/services/Imagery/2020_Ortho/ImageServer';

const SAMPLE_TILES = [
    { label: 'Mid-Atlantic seaboard', z: 5, x: 9, y: 12 },
    { label: 'Sierra Nevada ridge', z: 6, x: 11, y: 24 },
    { label: 'Central Midwest', z: 7, x: 32, y: 48 },
    { label: 'Kentucky foothills', z: 8, x: 66, y: 98 }
];

function assertBoundsIn4326(bounds: Array<number>): void {
    assert.equal(bounds.length, 4);
    assert.ok(bounds[0] >= -180 && bounds[0] <= 180, `Unexpected minLon: ${bounds[0]}`);
    assert.ok(bounds[1] >= -90 && bounds[1] <= 90, `Unexpected minLat: ${bounds[1]}`);
    assert.ok(bounds[2] >= -180 && bounds[2] <= 180, `Unexpected maxLon: ${bounds[2]}`);
    assert.ok(bounds[3] >= -90 && bounds[3] <= 90, `Unexpected maxLat: ${bounds[3]}`);
    assert.ok(bounds[0] < bounds[2], 'Expected minLon to be less than maxLon');
    assert.ok(bounds[1] < bounds[3], 'Expected minLat to be less than maxLat');
}

flight.init({ takserver: true });
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
            iconset: null,
            title: 'callsign',
            username: 'admin@example.com',
            attribution: null,
            frequency: null,
            hidden: false,
            sharing_enabled: false,
            sharing_token: null,
            collection: null,
            tilesize: 256,
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            scheme: 'xyz',
            styles: [],
            type: 'raster',
            snapping_enabled: false,
            snapping_layer: null
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/basemap - ArcGIS Imagery Source WKT Spatial Reference', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Jefferson County 2020 Ortho',
                url: JEFFERSON_COUNTY_IMAGERY_URL,
                sharing_enabled: false
            }
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.name, 'Jefferson County 2020 Ortho');
        assert.equal(res.body.url, JEFFERSON_COUNTY_IMAGERY_URL);
        assert.equal(res.body.type, 'raster');
        assert.equal(res.body.format, 'png');
        assert.equal(res.body.scheme, 'xyz');
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

        assert.deepEqual({
            ...res.body,
            bounds: undefined,
            center: undefined
        }, {
            tilejson: '3.0.0',
            version: '1.0.0',
            description: '',
            scheme: 'xyz',
            name: 'USGSNAIPImagery',
            type: 'raster',
            bounds: undefined,
            center: undefined,
            tileSize: 256,
            minzoom: 0,
            maxzoom: 16,
            actions: { feature: [] },
            tiles: [ 'http://localhost:5001/api/basemap/1/tiles/{z}/{x}/{y}' ]
        });

        assert.notDeepEqual(res.body.bounds, [ -180, -90, 180, 90 ]);
        assertBoundsIn4326(res.body.bounds);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/2/tiles - ArcGIS Imagery TileJSON WKT Spatial Reference', async () => {
    try {
        const res = await flight.fetch('/api/basemap/2/tiles', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.body.type, 'raster');
        assert.equal(res.body.scheme, 'xyz');
        assert.equal(res.body.name, 'Imagery/2020_Ortho');
        assertBoundsIn4326(res.body.bounds);
        assert.ok(res.body.bounds[0] > -89.2 && res.body.bounds[0] < -88.8, `Unexpected Jefferson County minLon: ${res.body.bounds[0]}`);
        assert.ok(res.body.bounds[3] > 43.1 && res.body.bounds[3] < 43.3, `Unexpected Jefferson County maxLat: ${res.body.bounds[3]}`);
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
