import test from 'node:test';
import assert from 'node:assert';
import IonControl, { parseAttribution, tokenExpiry, isIonAssetName } from '../stateless/lib/control/ion.js';

function jwt(payload: object): string {
    const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.signature`;
}

function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
    const calls: Array<{ url: string; auth: string | null }> = [];
    const fn = (async (input: string | URL | Request, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        calls.push({ url: String(input), auth: headers.get('Authorization') });
        const next = responses.shift();
        if (!next) throw new Error('unexpected fetch');
        return new Response(JSON.stringify(next.body), { status: next.status });
    }) as typeof fetch;
    return { fn, calls };
}

const ION_OSM = (exp: number) => ({
    type: '3DTILES',
    url: 'https://assets.ion.cesium.com/96188/tileset.json',
    accessToken: jwt({ exp }),
    attributions: [{ html: '<span>&copy; OpenStreetMap contributors</span>', collapsible: false }],
});

// Assets that ion proxies from another provider return options.url and no accessToken
const ION_EXTERNAL = {
    type: '3DTILES',
    externalType: '3DTILES',
    options: { url: 'https://tiles.example.com/v1/root.json?key=abc' },
    attributions: [{ html: '<a href="https://cesium.com"><img src="https://assets.ion.cesium.com/ion-credit.png" alt="Cesium ion"></a>', collapsible: false }],
};

test('isIonAssetName accepts only the allowlist', () => {
    assert.equal(isIonAssetName('osm-buildings'), true);
    assert.equal(isIonAssetName('toString'), false);
    assert.equal(isIonAssetName('96188'), false);
    assert.equal(isIonAssetName('__proto__'), false);
});

test('tokenExpiry reads exp from a JWT', () => {
    assert.equal(tokenExpiry(jwt({ exp: 1000 })), 1000 * 1000);
    assert.equal(tokenExpiry('not-a-jwt'), null);
    assert.equal(tokenExpiry(jwt({ iat: 5 })), null);
});

test('parseAttribution keeps text and cesium.com images only', () => {
    assert.deepEqual(parseAttribution('<span>&copy; OpenStreetMap contributors</span>'), { text: '© OpenStreetMap contributors' });
    assert.deepEqual(
        parseAttribution('<img src="https://assets.ion.cesium.com/ion-credit.png" alt="Cesium ion">'),
        { text: '', image: 'https://assets.ion.cesium.com/ion-credit.png' },
    );
    assert.deepEqual(parseAttribution('<img src="https://evil.example/x.png"><script>alert(1)</script>Data'), { text: 'alert(1) Data' });
    assert.deepEqual(parseAttribution('<img src="http://assets.ion.cesium.com/x.png">'), { text: '' });
    assert.deepEqual(parseAttribution('<img src="https://cesium.com.evil.example/x.png">'), { text: '' });
});

test('endpoint normalizes an ion-hosted asset', async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: ION_OSM(2_000_000) }]);
    const ion = new IonControl({ fetch: fn, now: () => 0 });

    const access = await ion.endpoint('osm-buildings', 'secret');

    assert.equal(calls[0].url, 'https://api.cesium.com/v1/assets/96188/endpoint');
    assert.equal(calls[0].auth, 'Bearer secret');
    assert.equal(access.url, 'https://assets.ion.cesium.com/96188/tileset.json');
    assert.ok(access.accessToken);
    assert.deepEqual(access.attributions, [{ text: '© OpenStreetMap contributors' }]);
});

test('endpoint normalizes an external asset', async () => {
    const { fn } = fakeFetch([{ status: 200, body: ION_EXTERNAL }]);
    const ion = new IonControl({ fetch: fn, now: () => 0 });

    const access = await ion.endpoint('osm-buildings', 'secret');

    assert.equal(access.url, 'https://tiles.example.com/v1/root.json?key=abc');
    assert.equal(access.accessToken, undefined);
    assert.deepEqual(access.attributions, [{ text: '', image: 'https://assets.ion.cesium.com/ion-credit.png' }]);
});

test('endpoint caches until 5 minutes before token expiry', async () => {
    let now = 0;
    const exp = 3600; // seconds
    const { fn, calls } = fakeFetch([
        { status: 200, body: ION_OSM(exp) },
        { status: 200, body: ION_OSM(exp * 2) },
    ]);
    const ion = new IonControl({ fetch: fn, now: () => now });

    await ion.endpoint('osm-buildings', 'secret');
    now = (exp - 5 * 60) * 1000 - 1;
    await ion.endpoint('osm-buildings', 'secret');
    assert.equal(calls.length, 1);

    now = (exp - 5 * 60) * 1000;
    await ion.endpoint('osm-buildings', 'secret');
    assert.equal(calls.length, 2);
});

test('endpoint without expiry caches for 50 minutes', async () => {
    let now = 0;
    const { fn, calls } = fakeFetch([
        { status: 200, body: ION_EXTERNAL },
        { status: 200, body: ION_EXTERNAL },
    ]);
    const ion = new IonControl({ fetch: fn, now: () => now });

    await ion.endpoint('osm-buildings', 'secret');
    now = 50 * 60 * 1000 - 1;
    await ion.endpoint('osm-buildings', 'secret');
    assert.equal(calls.length, 1);

    now = 50 * 60 * 1000;
    await ion.endpoint('osm-buildings', 'secret');
    assert.equal(calls.length, 2);
});

test('a different token bypasses the cache', async () => {
    const { fn, calls } = fakeFetch([
        { status: 200, body: ION_EXTERNAL },
        { status: 200, body: ION_EXTERNAL },
    ]);
    const ion = new IonControl({ fetch: fn, now: () => 0 });

    await ion.endpoint('osm-buildings', 'old');
    await ion.endpoint('osm-buildings', 'new');

    assert.equal(calls.length, 2);
    assert.equal(calls[1].auth, 'Bearer new');
});

test('ion 401 becomes 502 and is not cached', async () => {
    const { fn, calls } = fakeFetch([
        { status: 401, body: { code: 'InvalidCredentials' } },
        { status: 200, body: ION_EXTERNAL },
    ]);
    const ion = new IonControl({ fetch: fn, now: () => 0 });

    await assert.rejects(ion.endpoint('osm-buildings', 'secret'), (err: { status: number; safe: string }) => {
        assert.equal(err.status, 502);
        assert.equal(err.safe, 'Cesium ion rejected the token');
        return true;
    });

    await ion.endpoint('osm-buildings', 'secret');
    assert.equal(calls.length, 2);
});

test('network failure becomes 502', async () => {
    const ion = new IonControl({
        fetch: (async () => {
            throw new TypeError('fetch failed');
        }) as typeof fetch,
        now: () => 0,
    });

    await assert.rejects(ion.endpoint('osm-buildings', 'secret'), (err: { status: number }) => {
        assert.equal(err.status, 502);
        return true;
    });
});

test('unsupported asset type becomes 502', async () => {
    const { fn } = fakeFetch([{ status: 200, body: { type: 'TERRAIN', url: 'https://x' } }]);
    const ion = new IonControl({ fetch: fn, now: () => 0 });

    await assert.rejects(ion.endpoint('osm-buildings', 'secret'), (err: { status: number }) => {
        assert.equal(err.status, 502);
        return true;
    });
});
