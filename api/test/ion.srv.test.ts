import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { ionControl } from '../stateless/lib/control/ion.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false });

const ionCalls: Array<{ url: string; auth: string | null }> = [];

test('mock ion', () => {
    ionControl.cache.clear();
    ionControl.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        ionCalls.push({ url: String(input), auth: new Headers(init?.headers).get('Authorization') });
        return new Response(JSON.stringify({
            type: '3DTILES',
            url: 'https://assets.ion.cesium.com/96188/tileset.json',
            attributions: [{ html: '<span>&copy; OpenStreetMap contributors</span>' }],
        }), { status: 200 });
    }) as typeof fetch;
});

test('GET api/ion without auth', async () => {
    const res = await flight.fetch('/api/ion', { method: 'GET' }, false);
    assert.equal(res.status, 401);
});

test('GET api/ion without a token lists nothing', async () => {
    const res = await flight.fetch('/api/ion', { method: 'GET', auth: { bearer: flight.token.user } }, true);
    assert.deepEqual(res.body, { items: [] });
});

test('GET api/ion/:name/endpoint without a token', async () => {
    const res = await flight.fetch('/api/ion/osm-buildings/endpoint', { method: 'GET', auth: { bearer: flight.token.user } }, false);
    assert.equal(res.status, 404);
    assert.equal(res.body.message, 'Cesium ion is not configured');
});

test('PUT api/config ion::token', async () => {
    const res = await flight.fetch('/api/config', {
        method: 'PUT',
        auth: { bearer: flight.token.admin },
        body: { 'ion::token': 'config-token' },
    }, true);
    assert.deepEqual(res.body, { 'ion::token': 'config-token' });
});

test('GET api/config ion::token as non-admin', async () => {
    const res = await flight.fetch('/api/config?keys=ion::token', { method: 'GET', auth: { bearer: flight.token.user } }, false);
    assert.equal(res.status, 401);
    assert.equal(JSON.stringify(res.body).includes('config-token'), false);
});

test('GET api/ion lists the allowlist', async () => {
    const res = await flight.fetch('/api/ion', { method: 'GET', auth: { bearer: flight.token.user } }, true);
    assert.deepEqual(res.body, {
        items: [
            { name: 'osm-buildings', label: 'OSM Buildings' },
        ],
    });
});

test('GET api/ion/:name/endpoint rejects unknown names', async () => {
    const res = await flight.fetch('/api/ion/96188/endpoint', { method: 'GET', auth: { bearer: flight.token.user } }, false);
    assert.equal(res.status, 404);
    assert.equal(ionCalls.length, 0);
});

test('GET api/ion/:name/endpoint returns sanitized access', async () => {
    const res = await flight.fetch('/api/ion/osm-buildings/endpoint', { method: 'GET', auth: { bearer: flight.token.user } }, true);
    assert.deepEqual(res.body, {
        url: 'https://assets.ion.cesium.com/96188/tileset.json',
        attributions: [{ text: '© OpenStreetMap contributors' }],
    });
    assert.equal(ionCalls.length, 1);
    assert.equal(ionCalls[0].url, 'https://api.cesium.com/v1/assets/96188/endpoint');
    assert.equal(ionCalls[0].auth, 'Bearer config-token');
});

test('GET api/ion/:name/endpoint uses the cache', async () => {
    await flight.fetch('/api/ion/osm-buildings/endpoint', { method: 'GET', auth: { bearer: flight.token.user } }, true);
    assert.equal(ionCalls.length, 1);
});

test('clearing ion::token disables ion', async () => {
    await flight.fetch('/api/config', {
        method: 'PUT',
        auth: { bearer: flight.token.admin },
        body: { 'ion::token': '' },
    }, true);

    const list = await flight.fetch('/api/ion', { method: 'GET', auth: { bearer: flight.token.user } }, true);
    assert.deepEqual(list.body, { items: [] });

    const res = await flight.fetch('/api/ion/osm-buildings/endpoint', { method: 'GET', auth: { bearer: flight.token.user } }, false);
    assert.equal(res.status, 404);
    assert.equal(ionCalls.length, 1);
});

test('GET api/ion/geoid without auth', async () => {
    const res = await flight.fetch('/api/ion/geoid?lat=52.2318&lon=21.0067', { method: 'GET' }, false);
    assert.equal(res.status, 401);
});

// Reference undulations from PROJ 9 with the NGA us_nga_egm96_15 grid
for (const ref of [
    { place: 'Warsaw', lat: 52.2318, lon: 21.0067, undulation: 31.29 },
    { place: 'New York', lat: 40.7128, lon: -74.0060, undulation: -32.76 },
    { place: 'Sri Lanka', lat: 7, lon: 80, undulation: -96.75 },
]) {
    test(`GET api/ion/geoid: ${ref.place}`, async () => {
        const res = await flight.fetch(`/api/ion/geoid?lat=${ref.lat}&lon=${ref.lon}`, { method: 'GET', auth: { bearer: flight.token.user } }, true);
        assert.ok(Math.abs(res.body.undulation - ref.undulation) < 0.1, `${res.body.undulation} != ${ref.undulation}`);
    });
}

test('GET api/ion/geoid rejects a latitude out of range', async () => {
    const res = await flight.fetch('/api/ion/geoid?lat=91&lon=0', { method: 'GET', auth: { bearer: flight.token.user } }, false);
    assert.equal(res.status, 400);
});

test('GET api/ion/geoid rejects a longitude out of range', async () => {
    const res = await flight.fetch('/api/ion/geoid?lat=0&lon=-181', { method: 'GET', auth: { bearer: flight.token.user } }, false);
    assert.equal(res.status, 400);
});

flight.landing();
