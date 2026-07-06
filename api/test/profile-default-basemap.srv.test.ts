import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('Profile Default Basemap - No Basemaps - No Overlay Created', async () => {
    const res = await flight.fetch('/api/profile/overlay', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.equal(res.body.total, 0);
});

test('Profile Default Basemap - Create Basemaps', async () => {
    const zebra = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Zebra Basemap',
            url: 'https://test.com/zebra/{z}/{x}/{y}',
            protocol: 'zxy',
            scope: 'server',
        },
    }, true);

    assert.equal(zebra.body.id, 1);

    const alpha = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Alpha Basemap',
            url: 'https://test.com/alpha/{z}/{x}/{y}',
            protocol: 'zxy',
            scope: 'server',
        },
    }, true);

    assert.equal(alpha.body.id, 2);
});

test('Profile Default Basemap - Reject Config for Missing Basemap', async () => {
    const res = await flight.fetch('/api/config', {
        method: 'PUT',
        auth: { bearer: flight.token.admin },
        body: {
            'map::basemap': 999,
        },
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Default Basemap (999) does not exist');
});

test('Profile Default Basemap - Set Default Basemap Config', async () => {
    const res = await flight.fetch('/api/config', {
        method: 'PUT',
        auth: { bearer: flight.token.admin },
        body: {
            'map::basemap': 1,
        },
    }, true);

    assert.equal(res.body['map::basemap'], 1);
});

flight.user({ username: 'configured', admin: false });

test('Profile Default Basemap - New User Gets Configured Basemap', async () => {
    const res = await flight.fetch('/api/profile/overlay', {
        method: 'GET',
        auth: { bearer: flight.token.configured },
    }, true);

    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].mode, 'basemap');
    assert.equal(res.body.items[0].mode_id, '1');
    assert.equal(res.body.items[0].name, 'Zebra Basemap');
    assert.equal(res.body.items[0].url, '/api/basemap/1/tiles');
    assert.equal(res.body.items[0].pos, -1);
});

test('Profile Default Basemap - Unset Default Basemap Config', async () => {
    await flight.fetch('/api/config', {
        method: 'PUT',
        auth: { bearer: flight.token.admin },
        body: {
            'map::basemap': null,
        },
    }, true);
});

flight.user({ username: 'fallback', admin: false });

test('Profile Default Basemap - New User Falls Back to First Raster Basemap', async () => {
    const res = await flight.fetch('/api/profile/overlay', {
        method: 'GET',
        auth: { bearer: flight.token.fallback },
    }, true);

    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].mode, 'basemap');
    assert.equal(res.body.items[0].mode_id, '2');
    assert.equal(res.body.items[0].name, 'Alpha Basemap');
    assert.equal(res.body.items[0].url, '/api/basemap/2/tiles');
});

flight.landing();
