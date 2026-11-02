import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { basemapTileJSON } from '../stateless/lib/tilejson.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

let token: string;
let zxyToken: string;

test('POST: api/basemap - Shared ZXY Basemap', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: {
            bearer: flight.token.admin,
        },
        body: {
            name: 'Test Basemap',
            sharing_enabled: true,
            url: 'https://test.com/test/{z}/{x}/{y}',
            protocol: 'zxy',
        },
    }, true);

    assert.ok(res.body.sharing_token);
    zxyToken = res.body.sharing_token;
});

test('TileJSON: tiles advertise the PMTiles host', async () => {
    const basemap = await flight.config!.models.Basemap.from(1);
    const tilejson = await basemapTileJSON(flight.config!, basemap, { upstreamToken: flight.token.admin });

    assert.deepEqual(tilejson.tiles, [`${flight.base}/tiles/basemap/1/tiles/{z}/{x}/{y}`]);
});

test('TileJSON: tile URLs carry the token on the PMTiles host', async () => {
    const basemap = await flight.config!.models.Basemap.from(1);
    const tilejson = await basemapTileJSON(flight.config!, basemap, { token: flight.token.admin, upstreamToken: flight.token.admin });

    assert.deepEqual(tilejson.tiles, [`${flight.base}/tiles/basemap/1/tiles/{z}/{x}/{y}?token=${flight.token.admin}`]);
});

test('GET: api/basemap/1?format=xml - ATAK share URL of a zxy basemap stays upstream', async () => {
    const res = await flight.fetch('/api/basemap/1?format=xml', {
        method: 'GET',
        auth: {
            bearer: flight.token.admin,
        },
    }, { json: false });

    assert.ok(res.body.includes('<url>https://test.com/test/{z}/{x}/{y}</url>'), res.body);
});

test('POST: api/basemap - Shared ImageServer Basemap', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: {
            bearer: flight.token.admin,
        },
        body: {
            name: 'Imagery',
            sharing_enabled: true,
            url: 'https://example.com/arcgis/rest/services/Imagery/ImageServer',
            protocol: 'imageserver',
        },
    }, true);

    assert.equal(res.body.id, 2);
    assert.ok(res.body.sharing_token);
    token = res.body.sharing_token;
});

test('GET: api/basemap/2?format=xml - ATAK share URL of a proxied basemap uses the PMTiles host', async () => {
    const res = await flight.fetch('/api/basemap/2?format=xml', {
        method: 'GET',
        auth: {
            bearer: flight.token.admin,
        },
    }, { json: false });

    assert.ok(res.body.includes(`<url>${flight.base}/tiles/basemap/2/tiles/{$z}/{$x}/{$y}?token=${token}</url>`), res.body);
});

test('GET: api/basemap/1 - sharing token resolves on the API and advertises the PMTiles host', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'GET',
        auth: {
            bearer: zxyToken,
        },
    }, true);

    assert.equal(res.body.id, 1);
    assert.equal(res.body.url, 'https://test.com/test/{z}/{x}/{y}');
});

flight.landing();
