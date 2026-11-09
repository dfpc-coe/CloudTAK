import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { basemapTileJSON } from '../stateless/lib/tilejson.js';

const flight = new Flight();

const ARCGIS_FEATURE_URL = 'https://sampleserver6.arcgisonline.com/arcgis/rest/services/EmergencyFacilities/FeatureServer/0';

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
                bearer: flight.token.admin,
            },
            body: {
                name: 'Emergency Facilities',
                url: ARCGIS_FEATURE_URL,
                sharing_enabled: false,
                type: 'vector',
                format: 'mvt',
                protocol: 'featureserver',
            },
        }, true);

        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            parent: null,
            name: 'Emergency Facilities',
            actions: { feature: ['fetch', 'query'] },
            url: ARCGIS_FEATURE_URL,
            overlay: false,
            tilejson: null,
            args: {},
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
            protocol: 'featureserver',
            scheme: 'xyz',
            styles: [],
            type: 'vector',
            snapping_enabled: false,
            snapping_layer: null,
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
                bearer: flight.token.admin,
            },
            body: {
                tilejson: ARCGIS_FEATURE_URL,
            },
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

test('TileJSON: ArcGIS Feature Server', async () => {
    try {
        const basemap = await flight.config!.models.Basemap.from(1);
        const tilejson = await basemapTileJSON(flight.config!, basemap, { upstreamToken: flight.token.admin });

        assert.deepEqual({
            ...tilejson,
            bounds: undefined,
            center: undefined,
        }, {
            tilejson: '3.0.0',
            version: '1.0.0',
            attribution: undefined,
            description: '',
            scheme: 'xyz',
            name: 'Emergency Facilities',
            type: 'vector',
            bounds: undefined,
            center: undefined,
            tileSize: 256,
            minzoom: 0,
            maxzoom: 16,
            tiles: [`${flight.base}/tiles/basemap/1/tiles/{z}/{x}/{y}`],
            vector_layers: [{
                id: 'out',
                fields: {
                    objectid: 'number',
                    facilityid: 'string',
                    facname: 'string',
                    factype: 'integer',
                    organiz: 'string',
                    jurisdict: 'string',
                    pocname: 'string',
                    pocemail: 'string',
                    pocphone: 'string',
                    capacity: 'string',
                    hoursoper: 'string',
                    daysoper: 'string',
                    opendate: 'date-time',
                    closeddate: 'date-time',
                    opsstatus: 'string',
                    lastupdate: 'date-time',
                    lasteditor: 'string',
                    globalid: 'string',
                    imageurl: 'string',
                    curcapacity: 'integer',
                },
            }],
        });

        assert.notDeepEqual(tilejson.bounds, [-180, -90, 180, 90]);
        assertBoundsIn4326(tilejson.bounds);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
