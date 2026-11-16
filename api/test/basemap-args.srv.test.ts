import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const TILES = 'https://test.com/slope/7/tiles/{z}/{x}/{y}';

test('POST: api/basemap - args default to an empty map', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Plain',
            url: 'https://test.com/plain/{z}/{x}/{y}',
            protocol: 'zxy',
        },
    }, true);

    assert.equal(res.body.id, 1);
    assert.deepEqual(res.body.args, {});
});

test('POST: api/basemap - args are stored and returned', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Slope',
            url: TILES,
            protocol: 'zxy',
            overlay: true,
            args: {
                layer: ['27:30:ffeb3bc7', '30:35:ff9800c7'],
                format: 'png',
            },
        },
    }, true);

    assert.equal(res.body.id, 2);
    assert.deepEqual(res.body.args, {
        layer: ['27:30:ffeb3bc7', '30:35:ff9800c7'],
        format: 'png',
    });

    const get = await flight.fetch('/api/basemap/2', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.deepEqual(get.body.args, {
        layer: ['27:30:ffeb3bc7', '30:35:ff9800c7'],
        format: 'png',
    });
});

test('GET: api/basemap/:id/tiles - args are applied to the tile template', async () => {
    const res = await flight.fetch('/api/basemap/2/tiles', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.deepEqual(res.body.tiles, [
        `${flight.base}/tiles/basemap/2/tiles/{z}/{x}/{y}?layer=27%3A30%3Affeb3bc7&layer=30%3A35%3Aff9800c7&format=png`,
    ]);
});

test('PATCH: api/basemap - args are replaced wholesale', async () => {
    const res = await flight.fetch('/api/basemap/2', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            args: { layer: '35:90:f44336' },
        },
    }, true);

    assert.deepEqual(res.body.args, { layer: '35:90:f44336' });

    const tiles = await flight.fetch('/api/basemap/2/tiles', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.deepEqual(tiles.body.tiles, [`${flight.base}/tiles/basemap/2/tiles/{z}/{x}/{y}?layer=35%3A90%3Af44336`]);
});

test('POST: api/basemap - args values must be strings or string arrays', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Bad',
                url: 'https://test.com/bad/{z}/{x}/{y}',
                protocol: 'zxy',
                args: { layer: { lower: 27 } },
            },
        }, true);

        assert.fail();
    } catch (err) {
        assert.match(String(err), /400/);
    }
});

test('POST: api/profile/overlay - overlay args start from the request and patch independently', async () => {
    const created = await flight.fetch('/api/profile/overlay', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'My Slope',
            mode: 'overlay',
            mode_id: '2',
            type: 'raster',
            url: '/api/basemap/2/tiles',
            args: { layer: ['0:30:00ff00'] },
        },
    }, true);

    assert.deepEqual(created.body.args, { layer: ['0:30:00ff00'] });

    const patched = await flight.fetch(`/api/profile/overlay/${created.body.id}`, {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            args: { layer: ['30:90:ff0000'] },
        },
    }, true);

    assert.deepEqual(patched.body.args, { layer: ['30:90:ff0000'] });

    const basemap = await flight.fetch('/api/basemap/2', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.deepEqual(basemap.body.args, { layer: '35:90:f44336' }, 'overlay args never touch the basemap');
});

flight.landing();
