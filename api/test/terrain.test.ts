import test from 'node:test';
import assert from 'node:assert';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type Config from '../common/config.js';
import { Basemap_Type } from '../common/enums.js';
import { getElevation } from '../stateless/lib/terrain.js';

type Seen = { url?: string; authorization?: string; body?: {
    geometry: { type: string; coordinates: Array<Array<number>> };
    samples: number;
    zoom: number;
} };

/** A stand-in for the tile server that answers the elevation request with whatever the test sets */
async function tileServer(respond: () => { status: number; body: unknown }): Promise<{ url: string; seen: Seen; close: () => void }> {
    const seen: Seen = {};

    const server = createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => { raw += String(chunk); });
        req.on('end', () => {
            seen.url = req.url;
            seen.authorization = req.headers.authorization;
            seen.body = JSON.parse(raw);

            const answer = respond();
            res.writeHead(answer.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(answer.body));
        });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    return {
        url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/tiles/basemap`,
        seen,
        close: () => server.close(),
    };
}

function configFor(tilesUrl: string, terrain: { setting: number | null; basemap?: { id: number; type: Basemap_Type; maxzoom?: number | null } }): Config {
    return {
        BASEMAP_TILES_URL: tilesUrl,
        models: {
            Setting: { typed: async () => ({ value: terrain.setting }) },
            Basemap: { from: async () => terrain.basemap },
        },
    } as unknown as Config;
}

const sample = (elevation: number | null) => ({ status: 200, body: { samples: [{ distance: 0, coordinate: [174.7633, -36.8485], elevation }] } });

test('getElevation: asks the tile server for the elevation of the terrain basemap with the token of the user', async () => {
    const server = await tileServer(() => sample(42.5));

    try {
        const config = configFor(server.url, { setting: 7, basemap: { id: 7, type: Basemap_Type.TERRAIN, maxzoom: 12 } });
        const elevation = await getElevation(config, 'user-token', 174.7633, -36.8485);

        assert.equal(elevation, 42.5);
        assert.equal(server.seen.url, '/tiles/basemap/7/elevation');
        assert.equal(server.seen.authorization, 'Bearer user-token');
        assert.equal(server.seen.body?.geometry.type, 'LineString');
        assert.deepEqual(server.seen.body?.geometry.coordinates[0], [174.7633, -36.8485], 'the first sample is the point itself');
        assert.equal(server.seen.body?.geometry.coordinates.length, 2, 'a line needs two points');
        assert.notDeepEqual(server.seen.body?.geometry.coordinates[0], server.seen.body?.geometry.coordinates[1]);
        assert.equal(server.seen.body?.zoom, 12, 'the zoom of a basemap that stops below 15 is kept');
    } finally {
        server.close();
    }
});

test('getElevation: never asks for tiles above zoom 15', async () => {
    const server = await tileServer(() => sample(1));

    try {
        const high = configFor(server.url, { setting: 7, basemap: { id: 7, type: Basemap_Type.TERRAIN, maxzoom: 17 } });
        await getElevation(high, 't', 174.7633, -36.8485);
        assert.equal(server.seen.body?.zoom, 15);

        const none = configFor(server.url, { setting: 7, basemap: { id: 7, type: Basemap_Type.TERRAIN, maxzoom: null } });
        await getElevation(none, 't', 174.7633, -36.8485);
        assert.equal(server.seen.body?.zoom, 15);
    } finally {
        server.close();
    }
});

test('getElevation: the second point stays inside the longitude range at the antimeridian', async () => {
    const server = await tileServer(() => sample(0));

    try {
        const config = configFor(server.url, { setting: 7, basemap: { id: 7, type: Basemap_Type.TERRAIN } });
        await getElevation(config, 't', 179.9999995, -17);

        const [, second] = server.seen.body!.geometry.coordinates;
        assert.ok(second[0] <= 180, `longitude ${second[0]} is out of range`);
    } finally {
        server.close();
    }
});

test('getElevation: null without a terrain basemap, and the tile server is not asked', async () => {
    const server = await tileServer(() => sample(1));

    try {
        assert.equal(await getElevation(configFor(server.url, { setting: null }), 't', 1, 1), null);
        assert.equal(await getElevation(configFor(server.url, { setting: 7, basemap: { id: 7, type: Basemap_Type.RASTER } }), 't', 1, 1), null);
        assert.equal(server.seen.url, undefined);
    } finally {
        server.close();
    }
});

test('getElevation: null when the point has no data or the tile server fails', async () => {
    let answer: { status: number; body: unknown } = sample(null);
    const server = await tileServer(() => answer);

    try {
        const config = configFor(server.url, { setting: 7, basemap: { id: 7, type: Basemap_Type.TERRAIN } });

        assert.equal(await getElevation(config, 't', 1, 1), null, 'a sample without an elevation');

        answer = { status: 502, body: { status: 502, message: 'Failed to fetch tile' } };
        assert.equal(await getElevation(config, 't', 1, 1), null, 'a failing tile server');

        answer = { status: 400, body: { status: 400, message: 'Elevation profiles require raster-dem tiles' } };
        assert.equal(await getElevation(config, 't', 1, 1), null, 'a rejected request');

        answer = { status: 200, body: { samples: [] } };
        assert.equal(await getElevation(config, 't', 1, 1), null, 'no samples');
    } finally {
        server.close();
    }
});

test('getElevation: null when the tile server cannot be reached', async () => {
    const server = await tileServer(() => sample(1));
    const url = server.url;
    server.close();

    const config = configFor(url, { setting: 7, basemap: { id: 7, type: Basemap_Type.TERRAIN } });
    assert.equal(await getElevation(config, 't', 1, 1), null);
});
