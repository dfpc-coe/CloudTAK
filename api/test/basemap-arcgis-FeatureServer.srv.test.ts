import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

const ARCGIS_FEATURE_URL = 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/Wildfire/FeatureServer/0';

const SAMPLE_TILES = [
    { label: 'Pacific Northwest overview', z: 6, x: 10, y: 23 },
    { label: 'Cascade Range detail', z: 7, x: 20, y: 47 },
    { label: 'Upper Klamath region', z: 8, x: 41, y: 94 },
    { label: 'Crater Lake approach', z: 9, x: 83, y: 188 },
    { label: 'Klamath Falls close-up', z: 10, x: 166, y: 376 }
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

test('POST: api/basemap - ArcGIS Feature Server Source', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Wildfire Response Points',
                url: ARCGIS_FEATURE_URL,
                sharing_enabled: false,
                type: 'vector',
                format: 'mvt'
            }
        }, true);

        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            name: 'Wildfire Response Points',
            actions: { feature: ['fetch', 'query'] },
            url: ARCGIS_FEATURE_URL,
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
            format: 'mvt',
            scheme: 'xyz',
            styles: [],
            type: 'vector',
            snapping_enabled: false,
            snapping_layer: null
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/1 - ArcGIS Feature Server TileJSON Source', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                tilejson: ARCGIS_FEATURE_URL
            }
        }, true);

        delete res.body.created;
        delete res.body.updated;

        assert.equal(res.status, 200);
        assert.equal(res.body.id, 1);
        assert.equal(res.body.url, ARCGIS_FEATURE_URL);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1/tiles - ArcGIS Feature Server direct source', async () => {
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
            name: 'Wildfire Response Points',
            type: 'vector',
            bounds: undefined,
            center: undefined,
            tileSize: 256,
            minzoom: 0,
            maxzoom: 16,
            actions: { feature: ['fetch', 'query'] },
            tiles: [ 'http://localhost:5001/api/basemap/1/tiles/{z}/{x}/{y}' ],
            vector_layers: [{
                id: 'out',
                fields: {
                    objectid: 'number',
                    rotation: 'integer',
                    description: 'string',
                    eventdate: 'date-time',
                    eventtype: 'integer',
                    created_user: 'string',
                    created_date: 'date-time',
                    last_edited_user: 'string',
                    last_edited_date: 'date-time'
                }
            }]
        });

        assert.notDeepEqual(res.body.bounds, [ -180, -90, 180, 90 ]);
        assertBoundsIn4326(res.body.bounds);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1/tiles - ArcGIS Feature Server TileJSON', async () => {
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
            name: 'Wildfire Response Points',
            type: 'vector',
            bounds: undefined,
            center: undefined,
            tileSize: 256,
            minzoom: 0,
            maxzoom: 16,
            actions: { feature: ['fetch', 'query'] },
            tiles: [ 'http://localhost:5001/api/basemap/1/tiles/{z}/{x}/{y}' ],
            vector_layers: [{
                id: 'out',
                fields: {
                    objectid: 'number',
                    rotation: 'integer',
                    description: 'string',
                    eventdate: 'date-time',
                    eventtype: 'integer',
                    created_user: 'string',
                    created_date: 'date-time',
                    last_edited_user: 'string',
                    last_edited_date: 'date-time'
                }
            }]
        });

        assert.notDeepEqual(res.body.bounds, [ -180, -90, 180, 90 ]);
        assertBoundsIn4326(res.body.bounds);
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
            assert.equal(res.headers.get('content-type'), 'application/vnd.mapbox-vector-tile');
            assert.ok(res.body.length > 0, 'tile payload received');
        } catch (err) {
            assert.ifError(err);
        }
    });
}

flight.landing();
