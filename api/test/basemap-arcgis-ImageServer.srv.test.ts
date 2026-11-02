import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { basemapTileJSON } from '../stateless/lib/tilejson.js';
import { readFileSync } from 'node:fs';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const flight = new Flight();

const ARCGIS_IMAGERY_URL = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer';
const JEFFERSON_COUNTY_IMAGERY_URL = 'https://jeffarcgis.jeffersoncountywi.gov/arcgis/rest/services/Imagery/2020_Ortho/ImageServer';

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

const originalDispatcher = getGlobalDispatcher();

test('Mock ArcGIS ImageServer Metadata', () => {
    const agent = new MockAgent();
    agent.enableNetConnect();
    setGlobalDispatcher(agent);

    for (const [url, fixture] of [
        [ARCGIS_IMAGERY_URL, 'arcgis-imageserver-usgs-naip.json'],
        [JEFFERSON_COUNTY_IMAGERY_URL, 'arcgis-imageserver-jefferson-2020-ortho.json'],
    ]) {
        const { origin, pathname } = new URL(url);
        const body = readFileSync(new URL(`./fixtures/${fixture}`, import.meta.url), 'utf8');

        agent.get(origin).intercept({
            path: path => path.split('?')[0] === pathname,
            method: 'GET',
        }).reply(200, body, {
            headers: { 'content-type': 'application/json' },
        }).persist();
    }
});

test('POST: api/basemap - ArcGIS Imagery Source', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'USGS NAIP Imagery',
                url: ARCGIS_IMAGERY_URL,
                sharing_enabled: false,
                protocol: 'imageserver',
            },
        }, true);

        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            parent: null,
            name: 'USGS NAIP Imagery',
            actions: { feature: [] },
            url: ARCGIS_IMAGERY_URL,
            overlay: false,
            tilejson: null,
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
            protocol: 'imageserver',
            scheme: 'xyz',
            styles: [],
            type: 'raster',
            snapping_enabled: false,
            snapping_layer: null,
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
                bearer: flight.token.admin,
            },
            body: {
                name: 'Jefferson County 2020 Ortho',
                url: JEFFERSON_COUNTY_IMAGERY_URL,
                sharing_enabled: false,
                protocol: 'imageserver',
            },
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

test('TileJSON: ArcGIS Imagery', async () => {
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
            name: 'USGSNAIPImagery',
            type: 'raster',
            bounds: undefined,
            center: undefined,
            tileSize: 256,
            minzoom: 0,
            maxzoom: 16,
            tiles: [`${flight.base}/tiles/basemap/1/tiles/{z}/{x}/{y}`],
            vector_layers: undefined,
        });

        assert.notDeepEqual(tilejson.bounds, [-180, -90, 180, 90]);
        assertBoundsIn4326(tilejson.bounds);
    } catch (err) {
        assert.ifError(err);
    }
});

test('TileJSON: ArcGIS Imagery WKT Spatial Reference', async () => {
    try {
        const basemap = await flight.config!.models.Basemap.from(2);
        const tilejson = await basemapTileJSON(flight.config!, basemap, { upstreamToken: flight.token.admin });

        assert.equal(tilejson.type, 'raster');
        assert.equal(tilejson.scheme, 'xyz');
        assert.equal(tilejson.name, 'Imagery/2020_Ortho');
        assertBoundsIn4326(tilejson.bounds);
        assert.ok(tilejson.bounds[0] > -89.2 && tilejson.bounds[0] < -88.8, `Unexpected Jefferson County minLon: ${tilejson.bounds[0]}`);
        assert.ok(tilejson.bounds[3] > 43.1 && tilejson.bounds[3] < 43.3, `Unexpected Jefferson County maxLat: ${tilejson.bounds[3]}`);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Restore Dispatcher', () => {
    setGlobalDispatcher(originalDispatcher);
});

flight.landing();
