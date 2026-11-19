import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';
import { __resetForTests, upstreamAllowForTests } from '../stateless/lib/weather/relay-upstream.js';
import { riff, webp } from './weather-images.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false });

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const KEY = 'test-weather-key-0123456789';

// A multiple of 600 s so the snapshot arithmetic is easy to read
const NOW_S = 1800000000;
const LATEST = NOW_S - 600;
let nowMs = NOW_S * 1000;

type SnapMode = 'ok' | '404' | '400' | '500' | '429' | 'bad' | 'garbage' | 'slow';
type Echo = 'off' | 'on' | 'mismatch';

type Mode = 'ok' | 'nocache' | '500' | '401' | '403' | '404' | '400' | '429' | '302' | 'notimage' | 'custom' | 'wrongtype' | 'huge' | 'fallback' | 'error' | 'slow';

let upstream: http.Server;
let upstreamOrigin = '';
let mode: Mode = 'ok';
let delayMs = 0;
// Answer of the 'custom' mode: the declared content-type (null = no header) and the body
let customType: string | null = 'image/png';
let customBody: Buffer = PNG;
let retryAfterHeader: string | null = '7';
// Tile requests only. The snapshot endpoint is recorded in snapHits.
const hits: string[] = [];
const snapHits: string[] = [];
// Answer of the stub's /snapshot endpoint
let snapMode: SnapMode = 'ok';
// Newest snapshot per layer; a layer that is not set follows the test clock
let latestByLayer: Record<string, number> = {};
// off = an older proxy that sends no X-Weather-Snapshot, on = echo the requested snapshot,
// mismatch = answer with an older snapshot than requested
let echoSnapshot: Echo = 'off';
const SNAPSHOT_SLOW_MS = 400;

// Everything the API writes to the console for the whole file
const logs: string[] = [];
const original = { info: console.info, warn: console.warn, error: console.error };
for (const level of ['info', 'warn', 'error'] as const) {
    console[level] = (...args: unknown[]) => {
        logs.push(args.map(a => a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
    };
}

function configure(opts: { url?: string | null; key?: string | null; rate?: string | null } = {}) {
    const set = (name: string, value: string | null | undefined, fallback: string | null) => {
        const v = value === undefined ? fallback : value;
        if (v === null) {
            delete process.env[name];
        } else {
            process.env[name] = v;
        }
    };

    set('WEATHER_PROXY_URL', opts.url, `${upstreamOrigin}/weather`);
    set('WEATHER_PROXY_KEY', opts.key, KEY);
    set('WEATHER_RATE_LIMIT', opts.rate, null);
}

function fresh(opts: { env?: Parameters<typeof configure>[0]; upstreamTimeoutMs?: number; cacheMaxBytes?: number; latestBudgetMs?: number } = {}) {
    nowMs = NOW_S * 1000;
    mode = 'ok';
    delayMs = 0;
    customType = 'image/png';
    customBody = PNG;
    retryAfterHeader = '7';
    hits.length = 0;
    snapHits.length = 0;
    snapMode = 'ok';
    latestByLayer = {};
    echoSnapshot = 'off';
    configure(opts.env);
    __resetForTests({
        now: () => nowMs,
        upstreamTimeoutMs: opts.upstreamTimeoutMs,
        cacheMaxBytes: opts.cacheMaxBytes,
        latestBudgetMs: opts.latestBudgetMs,
    });
}

interface TileResult {
    status: number;
    headers: Headers;
    body: Buffer;
    json: () => { status: number; message: string };
}

async function tile(
    query: string,
    opts: { z?: number | string; x?: number | string; y?: number | string; auth?: string } = {},
): Promise<TileResult> {
    const { z = 4, x = 3, y = 5 } = opts;
    const auth = opts.auth ?? 'user';

    let url = `/api/weather/tile/${z}/${x}/${y}.png`;
    const req: { headers?: Record<string, string>; auth?: { bearer: string } } = {};
    let search = query;

    if (auth === 'query') {
        search += `${search ? '&' : ''}token=${flight.token.user}`;
    } else if (auth === 'user' || auth === 'admin') {
        req.auth = { bearer: flight.token[auth] };
    } else if (auth !== 'none') {
        req.auth = { bearer: auth };
    }

    if (search) url += `?${search}`;

    const res = await flight.fetch(url, req, { json: false, binary: true });
    const body = Buffer.from(res.body);
    return {
        status: res.status,
        headers: res.headers,
        body,
        json: () => JSON.parse(body.toString()),
    };
}

async function status(auth: 'user' | 'none' = 'user') {
    const req: { auth?: { bearer: string } } = {};
    if (auth === 'user') req.auth = { bearer: flight.token.user };
    return await flight.fetch('/api/weather/status', req, false);
}

function assertPng(res: TileResult, expected = PNG) {
    assert.equal(res.status, 200, res.status === 200 ? '' : res.body.toString());
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.ok(res.body.equals(expected), 'body is the upstream png');
}

function assertWebp(res: TileResult, expected: Buffer) {
    assert.equal(res.status, 200, res.status === 200 ? '' : res.body.toString());
    assert.equal(res.headers.get('content-type'), 'image/webp');
    assert.ok(res.body.equals(expected), 'body is the upstream webp');
}

function assertError(res: TileResult, code: number, message?: string) {
    assert.equal(res.status, code, res.body.toString());
    assert.equal(res.headers.get('cache-control'), 'no-store');
    if (message) assert.equal(res.json().message, message);
}

test('start upstream weather proxy', async () => {
    upstream = http.createServer((req, res) => {
        const incoming = new URL(String(req.url), 'http://localhost');

        if (incoming.pathname.endsWith('/snapshot')) {
            snapHits.push(String(req.url));
            const layer = incoming.searchParams.get('layer') ?? '';
            const snapshot = latestByLayer[layer] ?? (Math.floor(nowMs / 1000 / 600) * 600) - 600;

            const answer = () => {
                switch (snapMode) {
                    case 'ok':
                    case 'slow':
                        res.writeHead(200, { 'content-type': 'application/json', 'x-upstream-leak': 'yes' });
                        res.end(JSON.stringify({ snapshot, source: 'rainbow', layer, note: 'UPSTREAM-BODY-SECRET' }));
                        return;
                    case 'bad':
                        res.writeHead(200, { 'content-type': 'application/json' });
                        res.end('this is not json');
                        return;
                    case 'garbage':
                        res.writeHead(200, { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ snapshot: 'soon', source: 'UPSTREAM-BODY-SECRET' }));
                        return;
                    case '429':
                        res.writeHead(429, { 'content-type': 'application/json', 'retry-after': '7' });
                        res.end(JSON.stringify({ error: 'UPSTREAM-BODY-SECRET' }));
                        return;
                    default:
                        res.writeHead(Number(snapMode), { 'content-type': 'application/json' });
                        res.end(JSON.stringify({ error: 'UPSTREAM-BODY-SECRET' }));
                }
            };

            if (snapMode === 'slow') {
                setTimeout(answer, SNAPSHOT_SLOW_MS);
            } else {
                answer();
            }
            return;
        }

        hits.push(String(req.url));

        const respond = () => {
            const headers: Record<string, string | number> = { 'x-upstream-leak': 'yes', 'set-cookie': 'upstream=1' };

            const requested = incoming.searchParams.get('snapshot');
            if (requested !== null && echoSnapshot === 'on') headers['x-weather-snapshot'] = requested;
            if (requested !== null && echoSnapshot === 'mismatch') headers['x-weather-snapshot'] = String(Number(requested) - 600);

            switch (mode) {
                case 'ok':
                    res.writeHead(200, { ...headers, 'content-type': 'image/png' });
                    res.end(PNG);
                    return;
                case 'nocache':
                    res.writeHead(200, { ...headers, 'content-type': 'image/png', 'cache-control': 'no-store' });
                    res.end(PNG);
                    return;
                case 'fallback':
                    res.writeHead(200, { ...headers, 'content-type': 'image/png', 'x-weather-fallback': 'rainviewer' });
                    res.end(PNG);
                    return;
                case 'error':
                    res.writeHead(200, { ...headers, 'content-type': 'image/png', 'x-weather-error': '1' });
                    res.end(PNG);
                    return;
                case 'notimage':
                    res.writeHead(200, { ...headers, 'content-type': 'image/png' });
                    res.end('this is not an image file at all');
                    return;
                case 'custom':
                    res.writeHead(200, customType === null ? headers : { ...headers, 'content-type': customType });
                    res.end(customBody);
                    return;
                case 'wrongtype':
                    res.writeHead(200, { ...headers, 'content-type': 'text/html' });
                    res.end(PNG);
                    return;
                case 'huge':
                    res.writeHead(200, { ...headers, 'content-type': 'image/png' });
                    res.end(Buffer.concat([PNG, Buffer.alloc((1024 * 1024) + 1)]));
                    return;
                case '302':
                    res.writeHead(302, { ...headers, location: '/elsewhere.png' });
                    res.end();
                    return;
                case '429':
                    res.writeHead(429, {
                        ...headers,
                        ...(retryAfterHeader === null ? {} : { 'retry-after': retryAfterHeader }),
                        'content-type': 'application/json',
                    });
                    res.end(JSON.stringify({ error: 'UPSTREAM-BODY-SECRET' }));
                    return;
                default:
                    res.writeHead(Number(mode), { ...headers, 'content-type': 'application/json' });
                    res.end(JSON.stringify({ error: 'UPSTREAM-BODY-SECRET' }));
            }
        };

        if (mode === 'slow') {
            setTimeout(respond, 2000).unref();
            // Never answer a 'slow' request in time
            mode = 'ok';
        } else if (delayMs) {
            setTimeout(respond, delayMs);
        } else {
            respond();
        }
    });

    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', () => resolve()));
    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine upstream address');
    upstreamOrigin = `http://127.0.0.1:${address.port}`;
    upstreamAllowForTests.push(upstreamOrigin);
});

test('1. authentication', async () => {
    fresh();

    const none = await tile('layer=precip', { auth: 'none' });
    assertError(none, 401);

    const garbage = await tile('layer=precip', { auth: 'garbage' });
    assertError(garbage, 401);

    const garbageQuery = await flight.fetch('/api/weather/tile/4/3/5.png?layer=precip&token=garbage', {}, { json: false, binary: true });
    assert.equal(garbageQuery.status, 401);

    // A resource token is not a user session
    const resource = jwt.sign({ access: 'data', id: 1, internal: true }, 'coe-wildland-fire');
    const resourceRes = await tile('layer=precip', { auth: `etl.${resource}` });
    assert.ok([401, 403].includes(resourceRes.status), `resource token refused (${resourceRes.status})`);
    assertError(resourceRes, resourceRes.status);

    const resourceQuery = await flight.fetch(`/api/weather/tile/4/3/5.png?layer=precip&token=etl.${resource}`, {}, { json: false, binary: true });
    assert.ok([401, 403].includes(resourceQuery.status));

    assert.equal(hits.length, 0, 'upstream untouched');
});

test('2. success with bearer and with ?token=', async () => {
    fresh();

    const bearer = await tile('layer=precip&forecast=10&color=2');
    assertPng(bearer);
    assert.equal(bearer.headers.get('cache-control'), 'private, max-age=600');
    assert.equal(bearer.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(bearer.headers.get('x-weather-api'), '1');
    assert.equal(bearer.headers.get('x-weather-snapshot'), String(LATEST));
    assert.equal(bearer.headers.get('x-weather-cache'), 'miss');
    assert.equal(bearer.headers.get('attribution'), 'Weather data provided by Rainbow.ai');
    assert.equal(bearer.headers.get('content-length'), String(PNG.byteLength));

    const query = await tile('layer=precip&forecast=10&color=2', { auth: 'query' });
    assertPng(query);
    assert.equal(query.headers.get('x-weather-cache'), 'hit');

    assert.equal(hits.length, 1);

    // Nothing from the upstream and nothing secret is passed on
    for (const res of [bearer, query]) {
        assert.equal(res.headers.get('x-upstream-leak'), null);
        assert.equal(res.headers.get('set-cookie'), null);
        assert.ok(!JSON.stringify([...res.headers.entries()]).includes(KEY));
        assert.ok(!res.body.toString('latin1').includes(KEY));
    }
});

test('2b. a WebP body declared as image/png is served as image/webp', async () => {
    fresh();

    // The deployed weather-proxy labels its WebP clouds tiles image/png
    const body = webp();
    mode = 'custom';
    customType = 'image/png';
    customBody = body;

    const first = await tile('layer=clouds');
    assertWebp(first, body);
    assert.equal(first.headers.get('content-length'), String(body.byteLength));
    assert.equal(first.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(first.headers.get('x-weather-cache'), 'miss');
    assert.equal(first.headers.get('cache-control'), 'private, max-age=600');

    // Cache hits keep the type, for another user and with ?token=
    const admin = await tile('layer=clouds', { auth: 'admin' });
    assertWebp(admin, body);
    assert.equal(admin.headers.get('x-weather-cache'), 'hit');

    const query = await tile('layer=clouds', { auth: 'query' });
    assertWebp(query, body);
    assert.equal(query.headers.get('x-weather-cache'), 'hit');
    assert.equal(hits.length, 1);

    for (const res of [first, admin, query]) {
        assert.equal(res.headers.get('x-upstream-leak'), null);
        assert.equal(res.headers.get('set-cookie'), null);
        assert.ok(!JSON.stringify([...res.headers.entries()]).includes(KEY));
        assert.ok(!res.body.toString('latin1').includes(KEY));
    }

    // A PNG for another layer is still image/png and does not change the cached WebP
    mode = 'ok';
    assertPng(await tile('layer=precip'));
    assertWebp(await tile('layer=clouds'), body);
    assert.equal(hits.length, 2);

    // Other WebP chunk types, and an upstream that declares image/webp
    const variants: Array<[Buffer, string]> = [
        [webp('VP8X', 10), 'image/png'],
        [webp('VP8 ', 9), 'image/png'],
        [webp('VP8L', 6), 'image/webp'],
        [webp('VP8L', 6), 'IMAGE/WEBP; charset=binary'],
    ];
    for (const [i, [variant, declared]] of variants.entries()) {
        mode = 'custom';
        customType = declared;
        customBody = variant;
        assertWebp(await tile('layer=clouds', { x: 10 + i }), variant);
    }
});

test('2c. a WebP flight shared by concurrent callers keeps its type', async () => {
    fresh();
    mode = 'custom';
    customBody = webp();
    delayMs = 150;

    const results = await Promise.all(Array.from({ length: 5 }, () => tile('layer=clouds')));
    assert.equal(hits.length, 1);
    for (const res of results) assertWebp(res, customBody);

    const states = results.map(r => r.headers.get('x-weather-cache'));
    assert.equal(states.filter(s => s === 'miss').length, 1);
    assert.equal(states.filter(s => s === 'shared').length, 4);
});

test('3. disabled when the environment is not configured', async () => {
    for (const env of [
        { url: null },
        { key: null },
        { url: null, key: null },
        { url: 'not a url' },
        { url: `${upstreamOrigin}/weather?x=1` },
        { url: 'http://example.com/weather' },
        { key: 'short' },
        { key: 'bad key with spaces!!' },
    ]) {
        fresh({ env });
        const res = await tile('layer=precip');
        assertError(res, 403, 'Weather is disabled');
        assert.equal(hits.length, 0, JSON.stringify(env));
    }
});

test('3b. configuration is read on every request', async () => {
    fresh({ env: { url: null } });
    assertError(await tile('layer=precip'), 403, 'Weather is disabled');

    configure();
    assertPng(await tile('layer=precip'));

    configure({ key: null });
    assertError(await tile('layer=precip&forecast=10'), 403, 'Weather is disabled');
});

test('4. exact upstream URL per layer and option', async () => {
    const cases: Array<[string, string]> = [
        ['layer=precip', `layer=precip&snapshot=${LATEST}`],
        ['layer=precip-global&forecast=40&color=3&coverage=1&size=512', `layer=precip-global&color=3&forecast=40&coverage=1&snapshot=${LATEST}&size=512`],
        ['layer=clouds', `layer=clouds&snapshot=${LATEST}`],
        ['layer=radars&color=dbz_u8&coverage=1&use_precip_type=1', `layer=radars&color=dbz_u8&coverage=1&use_precip_type=1&snapshot=${LATEST}`],
        [`layer=precip&snapshot=${LATEST - 1200}`, `layer=precip&snapshot=${LATEST - 1200}`],
    ];

    for (const [query, expected] of cases) {
        fresh();
        assertPng(await tile(`${query}&token=${flight.token.user}`));
        assert.equal(hits.length, 1, query);
        assert.equal(hits[0], `/weather/4/3/5.png?provider=rainbow&${expected}&api=${KEY}`);
        assert.ok(!hits[0].includes('token'));
        assert.ok(!hits[0].includes(flight.token.user));
    }

    fresh();
    assertPng(await tile('layer=precip', { z: 9, x: 511, y: 0 }));
    assert.ok(hits[0].startsWith('/weather/9/511/0.png?provider=rainbow&layer=precip&'));
});

test('5. smuggling attempts are rejected before the upstream', async () => {
    fresh();

    for (const query of [
        'layer=precip&api=evil',
        'layer=precip&key=x',
        'layer=precip&provider=rainviewer',
        'layer=precip&foo=1',
        'layer=clouds&layer=precip',
        'layer=precip&forecast=10&forecast=20',
        'layer=precip&token=a&token=b',
    ]) {
        const res = await tile(query, query.includes('token=') ? { auth: 'user' } : {});
        assertError(res, 400);
    }

    // Repeated token (the first one is the valid session)
    const res = await flight.fetch(`/api/weather/tile/4/3/5.png?layer=precip&token=${flight.token.user}&token=${flight.token.user}`, {}, { json: false, binary: true });
    assert.equal(res.status, 400);

    assert.equal(hits.length, 0);
});

test('6. per layer rules', async () => {
    fresh();

    for (const query of [
        'layer=clouds&color=0',
        'layer=clouds&coverage=0',
        'layer=clouds&coverage=1',
        'layer=clouds&forecast=10',
        'layer=clouds&use_precip_type=1',
        'layer=radars&forecast=10',
        'layer=precip&use_precip_type=0',
        'layer=precip&use_precip_type=1',
        'layer=precip-global&use_precip_type=1',
        ...['5', '250', '-10', 'abc', '040', '1.5'].map(f => `layer=precip&forecast=${f}`),
    ]) {
        assertError(await tile(query), 400);
    }
    assert.equal(hits.length, 0);

    assertPng(await tile('layer=clouds&forecast=0'));
    assert.ok(!hits[0].includes('forecast'));

    assertPng(await tile('layer=radars&use_precip_type=1'));
    assert.ok(hits[1].includes('&use_precip_type=1&'));

    assertPng(await tile('layer=precip&forecast=0'));
    assert.ok(!hits[2].includes('forecast'));

    assertPng(await tile('layer=precip&forecast=240'));
    assert.ok(hits[3].includes('&forecast=240&'));

    assertError(await tile(''), 400);
    assertError(await tile('layer=wind'), 400);
});

test('7. coordinates', async () => {
    fresh();

    assertError(await tile('layer=precip', { z: 10, x: 0, y: 0 }), 400);
    assertError(await tile('layer=precip', { z: 6, x: 64, y: 0 }), 400);
    assertError(await tile('layer=precip', { z: 6, x: 0, y: 64 }), 400);
    assertError(await tile('layer=precip', { z: -1, x: 0, y: 0 }), 400);
    assertError(await tile('layer=precip', { z: 4, x: -3, y: 0 }), 400);
    assertError(await tile('layer=precip', { z: 'a', x: 0, y: 0 }), 400);
    assertError(await tile('layer=precip', { z: 4, x: 'b', y: 0 }), 400);
    assertError(await tile('layer=precip', { z: 4, x: 0, y: 'c' }), 400);
    assert.equal(hits.length, 0);

    assertPng(await tile('layer=precip', { z: 0, x: 0, y: 0 }));
    assertPng(await tile('layer=precip', { z: 6, x: 63, y: 63 }));
});

test('8. snapshot window', async () => {
    fresh();

    for (const snapshot of [`${LATEST}`, `${LATEST - 7200}`, 'latest']) {
        assertPng(await tile(`layer=precip&snapshot=${snapshot}`));
    }

    // Older than the two hour window, and malformed values
    for (const snapshot of [`${LATEST - 7800}`, `${LATEST - 8400}`, `${LATEST - 1}`, '179999940', 'abc', `${LATEST}0`]) {
        assertError(await tile(`layer=precip&snapshot=${snapshot}`), 400);
    }
    assertError(await tile(`layer=precip&snapshot=${LATEST - 7800}`), 400, 'snapshot out of range');
    assertError(await tile(`layer=precip&snapshot=${LATEST - 1}`), 400, 'Invalid snapshot');

    // A snapshot newer than the latest is served as the latest, not refused
    const newer = await tile(`layer=precip&snapshot=${LATEST + 600}`);
    assertPng(newer);
    assert.equal(newer.headers.get('x-weather-snapshot'), String(LATEST));
    assert.equal(newer.headers.get('x-weather-cache'), 'hit');

    // Absent means latest
    const absent = await tile('layer=precip&forecast=10');
    assert.equal(absent.headers.get('x-weather-snapshot'), String(LATEST));

    // The window moves with the clock
    nowMs += 600 * 1000;
    const later = await tile('layer=precip&forecast=10');
    assert.equal(later.headers.get('x-weather-snapshot'), String(LATEST + 600));
    assert.equal(later.headers.get('x-weather-cache'), 'miss');
    assertError(await tile(`layer=precip&snapshot=${LATEST - 7200}`), 400);
});

test('9. size and color', async () => {
    fresh();

    assertPng(await tile('layer=precip&size=512'));
    assert.ok(hits[0].includes('&size=512&'));

    assertPng(await tile('layer=precip&size=256&color=1'));
    assert.ok(!hits[1].includes('size='));

    assertError(await tile('layer=precip&size=128'), 400);
    assertError(await tile('layer=precip&size=1024'), 400);

    assertPng(await tile('layer=precip&color=dbz_u8'));
    assert.ok(hits[2].includes('&color=dbz_u8&'));
    assertError(await tile('layer=precip&color=10'), 400);
    assertError(await tile('layer=precip&color=-1'), 400);
});

test('10. per user rate limit with a fixed window', async () => {
    fresh({ env: { rate: '60' } });

    // Distinct tiles are not needed: cache hits also count
    for (let i = 1; i <= 60; i++) {
        const res = await tile('layer=precip');
        assert.equal(res.status, 200, `request ${i}`);
    }

    const denied = await tile('layer=precip');
    assertError(denied, 429);
    const first = Number(denied.headers.get('retry-after'));
    assert.ok(first >= 1 && first <= 60, `retry-after ${first}`);

    // The second user is unaffected
    assert.equal((await tile('layer=precip', { auth: 'admin' })).status, 200);

    // A later hit does not extend the window, the retry hint only shrinks
    nowMs += 30 * 1000;
    const stillDenied = await tile('layer=precip');
    assertError(stillDenied, 429);
    const second = Number(stillDenied.headers.get('retry-after'));
    assert.ok(second >= 1 && second < first, `retry-after ${second} < ${first}`);

    // The next window starts clean
    nowMs += 30 * 1000;
    assert.equal((await tile('layer=precip')).status, 200);
});

test('10b. invalid requests count against the limit', async () => {
    fresh({ env: { rate: '60' } });

    for (let i = 0; i < 60; i++) assertError(await tile('layer=wind'), 400);

    assertError(await tile('layer=precip'), 429);
    assert.equal(hits.length, 0);
});

test('11. upstream fetch budget per user', async () => {
    // rate 600 allows 200 upstream fetches per user and minute
    fresh({ env: { rate: '600' } });

    const tiles: Array<[number, number]> = [];
    for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) tiles.push([x, y]);
    }

    for (let i = 0; i < 200; i++) {
        const [x, y] = tiles[i];
        const res = await tile('layer=precip', { z: 4, x, y });
        assert.equal(res.status, 200, `fetch ${i + 1}`);
    }
    assert.equal(hits.length, 200);

    // A cached tile is not a fetch
    assert.equal((await tile('layer=precip', { z: 4, x: 0, y: 0 })).headers.get('x-weather-cache'), 'hit');

    const [x, y] = tiles[200];
    const denied = await tile('layer=precip', { z: 4, x, y });
    assertError(denied, 429);
    assert.ok(Number(denied.headers.get('retry-after')) >= 1);
    assert.equal(hits.length, 200);

    // Another user has their own budget
    assert.equal((await tile('layer=precip', { z: 4, x, y, auth: 'admin' })).status, 200);
});

test('12. upstream errors', async () => {
    fresh({ upstreamTimeoutMs: 250 });

    const failing: Array<[Mode, number, string]> = [
        ['500', 502, 'Weather upstream unavailable'],
        ['huge', 502, 'Weather upstream unavailable'],
        ['notimage', 502, 'Weather upstream unavailable'],
        ['wrongtype', 502, 'Weather upstream unavailable'],
        ['302', 502, 'Weather upstream unavailable'],
        ['404', 502, 'Weather upstream not found'],
        ['400', 400, 'Weather upstream rejected the request'],
        ['401', 502, 'Weather upstream authentication failed'],
        ['403', 502, 'Weather upstream authentication failed'],
    ];

    for (const [m, code, message] of failing) {
        mode = m;
        const before = hits.length;
        const res = await tile('layer=precip');
        assertError(res, code, message);
        assert.ok(!res.body.toString().includes('UPSTREAM-BODY-SECRET'));
        assert.equal(res.headers.get('set-cookie'), null);

        // Errors are never cached
        mode = m;
        assertError(await tile('layer=precip'), code, message);
        assert.equal(hits.length, before + 2, m);
    }

    mode = 'slow';
    const slow = await tile('layer=precip&forecast=10');
    assertError(slow, 502, 'Weather upstream unavailable');

    mode = '429';
    const limited = await tile('layer=precip&forecast=20');
    assertError(limited, 429);
    assert.equal(limited.headers.get('retry-after'), '7');

    // A healthy upstream answers the very same request once the pause is over
    nowMs += 7 * 1000;
    mode = 'ok';
    assertPng(await tile('layer=precip'));
});

test('12c. bodies that are not PNG or WebP are rejected', async () => {
    fresh();

    const notImages: Array<[string, Buffer]> = [
        ['json', Buffer.from('{"a":1}')],
        ['html', Buffer.from('<html><body>UPSTREAM-BODY-SECRET</body></html>')],
        ['riff without webp', riff('WAVE')],
        ['truncated riff', Buffer.from('RIFF')],
        ['4 bytes', Buffer.from([1, 2, 3, 4])],
        ['empty', Buffer.alloc(0)],
        ['webp without a chunk', webp().subarray(0, 12)],
        ['jpeg', Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0])],
    ];

    for (const [name, body] of notImages) {
        mode = 'custom';
        customType = 'image/png';
        customBody = body;
        const before = hits.length;

        const res = await tile('layer=clouds');
        assertError(res, 502, 'Weather upstream unavailable');
        assert.ok(!res.body.toString().includes('UPSTREAM-BODY-SECRET'), name);

        // Errors are not cached
        assertError(await tile('layer=clouds'), 502, 'Weather upstream unavailable');
        assert.equal(hits.length, before + 2, name);
    }

    // The declared type must still be an image type, whatever the bytes are
    const wrongDeclared: Array<[string, string | null, Buffer]> = [
        ['html + png', 'text/html', PNG],
        ['json + png', 'application/json', PNG],
        ['html + webp', 'text/html', webp()],
        ['missing + png', null, PNG],
    ];
    for (const [name, declared, body] of wrongDeclared) {
        mode = 'custom';
        customType = declared;
        customBody = body;
        assertError(await tile('layer=precip'), 502, 'Weather upstream unavailable');
        assert.ok(hits.length > 0, name);
    }

    const text = logs.join('\n');
    assert.ok(text.includes('upstream failed (not an image)'));
    assert.ok(text.includes('upstream failed (content-type)'));
    assert.ok(!text.includes('not a png'));
    assert.ok(!text.includes(KEY));
    assert.ok(!text.includes(flight.token.user));
});

test('12b. a blocked upstream address is a 502', async () => {
    fresh({ env: { url: 'https://127.0.0.1:1/weather' } });

    const res = await tile('layer=precip');
    assertError(res, 502, 'Weather upstream unavailable');
    assert.equal(hits.length, 0);
});

test('13. fallback and error headers', async () => {
    fresh();

    // Current radar is acceptable only for a request that asks for current data
    mode = 'fallback';
    const now = await tile('layer=precip');
    assertPng(now);
    assert.equal(now.headers.get('cache-control'), 'private, max-age=30');
    assert.equal(now.headers.get('x-weather-fallback'), null);

    const again = await tile('layer=precip');
    assertPng(again);
    assert.equal(again.headers.get('x-weather-cache'), 'miss', 'fallback tiles are not cached');
    assert.equal(hits.length, 2);

    mode = 'fallback';
    assertError(await tile('layer=precip&forecast=40'), 502, 'Weather upstream unavailable');

    // A transparent error tile is never shown
    for (const query of ['layer=precip', 'layer=precip&forecast=40', 'layer=clouds', 'layer=radars']) {
        mode = 'error';
        assertError(await tile(query), 502, 'Weather upstream unavailable');
    }

    // An older proxy without the headers behaves like a healthy one
    fresh();
    assertPng(await tile('layer=precip&forecast=40'));
    const hit = await tile('layer=precip&forecast=40');
    assert.equal(hit.headers.get('x-weather-cache'), 'hit');
    assert.equal(hit.headers.get('cache-control'), 'private, max-age=600');
    assert.equal(hits.length, 1);

    // The upstream can opt out of caching
    fresh();
    mode = 'nocache';
    assertPng(await tile('layer=precip'));
    mode = 'nocache';
    assertPng(await tile('layer=precip'));
    assert.equal(hits.length, 2);
});

test('14. cache', async () => {
    fresh();

    const first = await tile('layer=precip&forecast=10');
    assert.equal(first.headers.get('x-weather-cache'), 'miss');

    const second = await tile('layer=precip&forecast=10');
    assert.equal(second.headers.get('x-weather-cache'), 'hit');
    assert.equal(hits.length, 1);

    // The cache is shared between users
    const other = await tile('layer=precip&forecast=10', { auth: 'admin' });
    assert.equal(other.headers.get('x-weather-cache'), 'hit');
    assertPng(other);
    assert.equal(hits.length, 1);

    // Different parameters and a different snapshot are different tiles
    assert.equal((await tile('layer=precip&forecast=20')).headers.get('x-weather-cache'), 'miss');
    assert.equal((await tile(`layer=precip&forecast=10&snapshot=${LATEST - 600}`)).headers.get('x-weather-cache'), 'miss');
    assert.equal((await tile('layer=precip&forecast=10', { x: 4 })).headers.get('x-weather-cache'), 'miss');
    assert.equal(hits.length, 4);

    // Entries expire after 10 minutes. The snapshot is pinned so the key stays the same.
    const pinned = `layer=precip&forecast=30&snapshot=${LATEST - 600}`;
    assert.equal((await tile(pinned)).headers.get('x-weather-cache'), 'miss');
    nowMs += 599 * 1000;
    assert.equal((await tile(pinned)).headers.get('x-weather-cache'), 'hit');
    nowMs += 2 * 1000;
    assert.equal((await tile(pinned)).headers.get('x-weather-cache'), 'miss');
});

test('14b. least recently used tiles are evicted when the byte budget is full', async () => {
    // Room for exactly two tiles
    fresh({ cacheMaxBytes: PNG.byteLength * 2 });

    await tile('layer=precip', { x: 0 });
    await tile('layer=precip', { x: 1 });
    assert.equal((await tile('layer=precip', { x: 0 })).headers.get('x-weather-cache'), 'hit');

    // x=1 is now the least recently used and makes room for x=2
    await tile('layer=precip', { x: 2 });
    assert.equal((await tile('layer=precip', { x: 0 })).headers.get('x-weather-cache'), 'hit');
    assert.equal((await tile('layer=precip', { x: 1 })).headers.get('x-weather-cache'), 'miss');
});

test('15. concurrent identical requests share one upstream fetch', async () => {
    fresh();
    delayMs = 150;

    const results = await Promise.all(Array.from({ length: 10 }, () => tile('layer=precip&forecast=10')));

    assert.equal(hits.length, 1);
    for (const res of results) assertPng(res);

    const states = results.map(r => r.headers.get('x-weather-cache'));
    assert.equal(states.filter(s => s === 'miss').length, 1);
    assert.equal(states.filter(s => s === 'shared').length, 9);
});

test('15b. followers of a failing flight get the same error and nothing is cached', async () => {
    fresh();
    delayMs = 100;
    mode = '500';

    const results = await Promise.all(Array.from({ length: 4 }, () => tile('layer=precip')));
    assert.equal(hits.length, 1);
    for (const res of results) assertError(res, 502);

    mode = 'ok';
    delayMs = 0;
    assertPng(await tile('layer=precip'));
    assert.equal(hits.length, 2);
});

test('16. status', async () => {
    fresh();

    const anonymous = await status('none');
    assert.equal(anonymous.status, 401);

    const res = await status();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Object.keys(res.body).sort(), ['apiVersion', 'enabled', 'latest', 'layers', 'serverTime', 'snapshot', 'stepSeconds', 'windowSeconds']);
    assert.deepEqual(res.body, {
        apiVersion: 1,
        enabled: true,
        serverTime: NOW_S,
        snapshot: LATEST,
        layers: ['precip', 'precip-global', 'clouds', 'radars'],
        latest: {
            'precip': { snapshot: LATEST, source: 'rainbow' },
            'precip-global': { snapshot: LATEST, source: 'rainbow' },
            'clouds': { snapshot: LATEST, source: 'rainbow' },
            'radars': { snapshot: LATEST, source: 'rainbow' },
        },
        stepSeconds: 600,
        windowSeconds: 7200,
    });
    assert.equal(res.body.snapshot % 600, 0);
    assert.ok(!JSON.stringify(res.body).includes(KEY));
    assert.ok(!JSON.stringify(res.body).includes(upstreamOrigin));

    nowMs += (600 * 1000) + 5000;
    const later = await status();
    assert.equal(later.body.serverTime, NOW_S + 605);
    assert.equal(later.body.snapshot, Math.floor((NOW_S + 605) / 600) * 600 - 600);

    // The status call asks the proxy for the newest snapshot of each layer, never for tiles
    assert.equal(hits.length, 0);
    assert.equal(snapHits.length, 8);

    // A disabled relay is reported, not an error
    fresh({ env: { url: null } });
    const disabled = await status();
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.enabled, false);
    assert.deepEqual(disabled.body.layers, []);
    assert.equal(disabled.body.snapshot % 600, 0);
    assert.equal('latest' in disabled.body, false);
    assert.equal(disabled.body.stepSeconds, 600);
    assert.equal(disabled.body.windowSeconds, 7200);
    assert.equal(snapHits.length, 0, 'a disabled relay does not call the proxy');

    // 60 calls a minute
    fresh();
    for (let i = 0; i < 60; i++) assert.equal((await status()).status, 200, `call ${i + 1}`);
    const limited = await status();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) >= 1);
    nowMs += 60 * 1000;
    assert.equal((await status()).status, 200);
});

test('17. API key and session tokens never reach the console output', async () => {
    // Provoke the error paths that log: upstream failures and bad configuration
    fresh();
    mode = '401';
    await tile('layer=precip');
    mode = '500';
    await tile('layer=precip&forecast=10');
    configure({ url: 'not a url', key: 'bad key' });
    await tile('layer=precip');
    configure();
    mode = 'ok';
    assertPng(await tile('layer=precip&forecast=20', { auth: 'query' }));
    const lastPng = logs.length;

    mode = 'custom';
    customBody = webp();
    assertWebp(await tile('layer=clouds', { auth: 'query' }), customBody);

    assert.ok(logs.length > 0);

    const sessions = [flight.token.user, flight.token.admin];
    for (const line of logs) {
        assert.ok(!line.includes(KEY), 'api key in log');
        for (const session of sessions) assert.ok(!line.includes(session), 'session token in log');
    }

    const audit = logs.filter(l => l.startsWith('{') && l.includes('"type":"weather"'));
    assert.ok(audit.length > 0);
    for (const line of audit) {
        const parsed = JSON.parse(line);
        assert.equal(parsed.type, 'weather');
        assert.ok('username' in parsed && 'status' in parsed && 'cache' in parsed && 'ms' in parsed);
        assert.ok(!('token' in parsed) && !('query' in parsed));
    }

    // Only successful answers have a content type
    for (const line of audit) {
        const parsed = JSON.parse(line);
        assert.ok('contentType' in parsed);
        assert.equal(parsed.contentType === null, parsed.status !== 200, line);
    }

    const isAudit = (l: string) => l.startsWith('{') && l.includes('"type":"weather"');
    const png = JSON.parse(logs.slice(0, lastPng).filter(isAudit).pop() as string);
    assert.equal(png.username, 'user@example.com');
    assert.equal(png.layer, 'precip');
    assert.equal(png.forecast, 20);
    assert.equal(png.status, 200);
    assert.equal(png.cache, 'miss');
    assert.equal(png.contentType, 'image/png');

    const last = JSON.parse(audit[audit.length - 1]);
    assert.equal(last.layer, 'clouds');
    assert.equal(last.status, 200);
    assert.equal(last.contentType, 'image/webp');
});

test('18. an upstream 429 pauses every cache miss; cache hits are still served', async () => {
    fresh();

    const cached = 'layer=precip&forecast=10';
    assertPng(await tile(cached));
    assert.equal(hits.length, 1);

    mode = '429';
    retryAfterHeader = '20';
    const limited = await tile('layer=precip&forecast=20');
    assertError(limited, 429, 'Weather upstream is rate limiting requests');
    assert.equal(limited.headers.get('retry-after'), '20');
    assert.equal(hits.length, 2, 'the 429 itself reached the proxy');

    // The proxy is healthy again, but the relay does not ask while paused
    mode = 'ok';
    for (const query of ['layer=precip&forecast=20', 'layer=clouds', 'layer=radars']) {
        for (const auth of ['user', 'admin'] as const) {
            const res = await tile(query, { auth });
            assertError(res, 429, 'Weather upstream is rate limiting requests');
            assert.equal(res.headers.get('retry-after'), '20');
            assert.ok(!res.body.toString().includes('UPSTREAM-BODY-SECRET'));
        }
    }
    assert.equal(hits.length, 2, 'no upstream call during the pause');

    // The retry hint shrinks with the clock
    nowMs += 15 * 1000;
    const later = await tile('layer=clouds');
    assertError(later, 429);
    assert.equal(later.headers.get('retry-after'), '5');
    assert.equal(hits.length, 2);

    // A cached tile is served during the pause, for every user
    for (const auth of ['user', 'admin'] as const) {
        const hit = await tile(cached, { auth });
        assertPng(hit);
        assert.equal(hit.headers.get('x-weather-cache'), 'hit');
    }
    assert.equal(hits.length, 2);

    // One second before the end it is still paused, then the proxy is asked again
    nowMs += 4 * 1000;
    assertError(await tile('layer=clouds'), 429);
    assert.equal(hits.length, 2);
    nowMs += 1000;
    const after = await tile('layer=clouds');
    assertPng(after);
    assert.equal(after.headers.get('x-weather-cache'), 'miss');
    assert.equal(hits.length, 3);
    assertPng(await tile('layer=precip&forecast=20'));
    assert.equal(hits.length, 4);
});

test('18b. followers of a flight that ends in 429 share it and the pause covers other tiles', async () => {
    fresh();
    delayMs = 100;
    mode = '429';

    const results = await Promise.all(Array.from({ length: 4 }, () => tile('layer=precip')));
    assert.equal(hits.length, 1);
    for (const res of results) {
        assertError(res, 429);
        assert.equal(res.headers.get('retry-after'), '7');
    }

    delayMs = 0;
    mode = 'ok';
    assertError(await tile('layer=precip', { x: 9 }), 429);
    assert.equal(hits.length, 1);
});

test('18c. the pause length is the upstream Retry-After clamped to 5..120 s, default 30 s', async () => {
    const cases: Array<[string | null, number]> = [
        ['0', 5], ['1', 5], ['4', 5], ['5', 5], ['60', 60], ['120', 120], ['121', 120], ['999', 120],
        ['999999', 120], [null, 30], ['soon', 30], ['1000000', 30], ['-5', 30],
    ];

    for (const [header, expected] of cases) {
        fresh();
        mode = '429';
        retryAfterHeader = header;
        const first = await tile('layer=precip');
        assertError(first, 429);
        assert.equal(first.headers.get('retry-after'), String(expected), `upstream retry-after ${header}`);

        mode = 'ok';
        nowMs += (expected - 1) * 1000;
        const paused = await tile('layer=precip');
        assertError(paused, 429);
        assert.equal(paused.headers.get('retry-after'), '1', `still paused for ${header}`);
        assert.equal(hits.length, 1);

        nowMs += 1000;
        assertPng(await tile('layer=precip'));
        assert.equal(hits.length, 2);
    }
});

test('18d. the task fetch cap is 500 a minute and starts a pause', async () => {
    // High per user limits so only the task cap can stop the loop
    fresh({ env: { rate: '3000' } });

    for (let i = 0; i < 500; i++) {
        const res = await tile('layer=precip', { z: 5, x: i % 32, y: Math.floor(i / 32) });
        assert.equal(res.status, 200, `fetch ${i + 1}`);
    }
    assert.equal(hits.length, 500);

    const denied = await tile('layer=precip', { z: 5, x: 0, y: 16 });
    assertError(denied, 429);
    assert.equal(denied.headers.get('retry-after'), '60');
    assert.equal((await tile('layer=precip', { z: 5, x: 1, y: 16, auth: 'admin' })).status, 429);
    assert.equal(hits.length, 500);

    // Cache hits are not fetches
    const hit = await tile('layer=precip', { z: 5, x: 0, y: 0 });
    assert.equal(hit.headers.get('x-weather-cache'), 'hit');

    // The window rolls over after 60 s and the pause ends with it
    nowMs += 60 * 1000;
    assertPng(await tile('layer=precip', { z: 5, x: 0, y: 16 }));
    assert.equal(hits.length, 501);
});

test('19. the access log never contains the session token', async () => {
    fresh();

    const lines: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
        const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
        if (text.includes('/api/weather')) {
            lines.push(text);
            return true;
        }
        return (write as (...args: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof process.stdout.write;

    try {
        mode = '500';
        assert.equal((await tile('layer=precip', { auth: 'query' })).status, 502);
        mode = 'ok';
        assertPng(await tile('layer=precip&forecast=10', { auth: 'query' }));
        assert.equal((await tile('layer=wind', { auth: 'query' })).status, 400);
        const bad = await flight.fetch('/api/weather/tile/4/3/5.png?layer=precip&token=garbage-session-value', {}, { json: false, binary: true });
        assert.equal(bad.status, 401);
        // Let morgan write the last line
        await new Promise(resolve => setTimeout(resolve, 50));
    } finally {
        process.stdout.write = write;
    }

    const tiles = lines.filter(l => l.includes('/api/weather/tile'));
    assert.ok(tiles.length >= 3, `captured ${tiles.length} access log lines`);
    for (const line of lines) {
        assert.ok(!line.includes(flight.token.user), 'session token in access log');
        assert.ok(!line.includes('garbage-session-value'), 'token value in access log');
        assert.ok(!line.includes(KEY), 'api key in access log');
    }
    assert.ok(tiles.some(l => l.includes('token=***')));
});

const LAYER_NAMES = ['precip', 'precip-global', 'clouds', 'radars'];

test('20. status reports the newest snapshot of every layer', async () => {
    fresh();
    // Rainbow publishes clouds later than the other layers
    latestByLayer = { 'precip': LATEST, 'precip-global': LATEST, 'clouds': LATEST - 600, 'radars': LATEST };

    const res = await status();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.latest, {
        'precip': { snapshot: LATEST, source: 'rainbow' },
        'precip-global': { snapshot: LATEST, source: 'rainbow' },
        'clouds': { snapshot: LATEST - 600, source: 'rainbow' },
        'radars': { snapshot: LATEST, source: 'rainbow' },
    });
    assert.equal(res.body.snapshot, LATEST);
    assert.equal(res.body.stepSeconds, 600);
    assert.equal(res.body.windowSeconds, 7200);

    // One call per layer, with the key as the proxy's api parameter, and nothing of it is passed on
    assert.deepEqual(snapHits.map(h => h.split('&')[0]).sort(), LAYER_NAMES.map(l => `/weather/snapshot?layer=${l}`).sort());
    for (const hit of snapHits) assert.ok(hit.endsWith(`&api=${KEY}`), hit);
    const text = JSON.stringify(res.body);
    assert.ok(!text.includes(KEY));
    assert.ok(!text.includes('UPSTREAM-BODY-SECRET'));
    assert.equal(hits.length, 0);

    // A proxy answer newer than the clock allows is not trusted
    fresh();
    latestByLayer = { clouds: LATEST + 6000 };
    const odd = await status();
    assert.equal(odd.status, 200);
    assert.deepEqual(odd.body.latest.clouds, { snapshot: LATEST, source: 'computed' });
    assert.deepEqual(odd.body.latest.precip, { snapshot: LATEST, source: 'rainbow' });
});

test('20b. status falls back to the computed snapshot when the proxy has no usable answer', async () => {
    for (const m of ['404', '400', '500', 'bad', 'garbage'] as SnapMode[]) {
        fresh();
        snapMode = m;
        const res = await status();
        assert.equal(res.status, 200, m);
        for (const layer of LAYER_NAMES) {
            assert.deepEqual(res.body.latest[layer], { snapshot: LATEST, source: 'computed' }, `${m} ${layer}`);
        }
        assert.ok(!JSON.stringify(res.body).includes('UPSTREAM-BODY-SECRET'), m);
        assert.equal(snapHits.length, 4, m);

        // An older proxy that answers 404 is not asked again for every tile
        assertPng(await tile('layer=clouds'));
        assertPng(await tile('layer=clouds', { x: 4 }));
        assert.equal(snapHits.length, 4, `${m}: cached`);
        assert.equal(hits.length, 2);
    }

    // The proxy cannot be reached at all
    fresh({ env: { url: 'https://127.0.0.1:1/weather' } });
    const blocked = await status();
    assert.equal(blocked.status, 200);
    assert.equal(blocked.body.latest.clouds.source, 'computed');
});

test('20c. a slow snapshot endpoint does not hold up the status beyond the budget', async () => {
    fresh({ latestBudgetMs: 100 });
    snapMode = 'slow';

    const started = Date.now();
    const res = await status();
    assert.equal(res.status, 200);
    assert.ok(Date.now() - started < SNAPSHOT_SLOW_MS, 'answered before the proxy did');
    for (const layer of LAYER_NAMES) assert.deepEqual(res.body.latest[layer], { snapshot: LATEST, source: 'computed' });

    // The lookups finish in the background and the next call has the real values
    latestByLayer = {};
    await new Promise(resolve => setTimeout(resolve, SNAPSHOT_SLOW_MS + 150));
    const next = await status();
    assert.equal(next.status, 200);
    for (const layer of LAYER_NAMES) assert.deepEqual(next.body.latest[layer], { snapshot: LATEST, source: 'rainbow' });
    assert.equal(snapHits.length, 4, 'no second round of calls');
});

test('20d. the newest snapshot of a layer is cached for 30 s', async () => {
    fresh();

    await status();
    await status();
    assert.equal(snapHits.length, 4);

    // The tile route shares the same cache
    assertPng(await tile('layer=precip'));
    assertPng(await tile('layer=clouds'));
    assert.equal(snapHits.length, 4);

    nowMs += 29 * 1000;
    await status();
    assert.equal(snapHits.length, 4);

    latestByLayer = { clouds: LATEST - 600 };
    nowMs += 2 * 1000;
    const later = await status();
    assert.equal(snapHits.length, 8);
    assert.deepEqual(later.body.latest.clouds, { snapshot: LATEST - 600, source: 'rainbow' });

    // Concurrent callers share one lookup per layer
    fresh();
    await Promise.all(Array.from({ length: 6 }, () => status()));
    assert.equal(snapHits.length, 4);
});

test('21. a snapshot newer than the layer latest is clamped and shares one upstream call and cache entry', async () => {
    fresh();
    echoSnapshot = 'on';

    const first = await tile(`layer=precip&forecast=10&snapshot=${LATEST + 600}`);
    assertPng(first);
    assert.equal(first.headers.get('x-weather-snapshot'), String(LATEST));
    assert.equal(first.headers.get('x-weather-cache'), 'miss');

    const second = await tile(`layer=precip&forecast=10&snapshot=${LATEST}`);
    assert.equal(second.headers.get('x-weather-snapshot'), String(LATEST));
    assert.equal(second.headers.get('x-weather-cache'), 'hit');

    const third = await tile('layer=precip&forecast=10&snapshot=latest', { auth: 'admin' });
    assert.equal(third.headers.get('x-weather-cache'), 'hit');

    assert.equal(hits.length, 1);
    assert.ok(hits[0].includes(`&snapshot=${LATEST}&`), hits[0]);
    assert.ok(!hits[0].includes(String(LATEST + 600)));
});

test('21b. a lagging layer is requested with its own latest snapshot', async () => {
    fresh();
    echoSnapshot = 'on';
    latestByLayer = { clouds: LATEST - 600 };

    const clouds = await tile(`layer=clouds&snapshot=${LATEST}`);
    assertPng(clouds);
    assert.equal(clouds.headers.get('x-weather-snapshot'), String(LATEST - 600));
    assert.equal(hits.length, 1);
    assert.ok(hits[0].includes(`layer=clouds&snapshot=${LATEST - 600}&`), hits[0]);

    // Asking for the lagging snapshot itself, or for no snapshot, is the same tile
    for (const query of [`layer=clouds&snapshot=${LATEST - 600}`, 'layer=clouds', 'layer=clouds&snapshot=latest']) {
        const same = await tile(query);
        assert.equal(same.headers.get('x-weather-cache'), 'hit', query);
        assert.equal(same.headers.get('x-weather-snapshot'), String(LATEST - 600), query);
    }
    assert.equal(hits.length, 1);

    // The window of the layer ends two hours before its own latest
    assertPng(await tile(`layer=clouds&snapshot=${LATEST - 600 - 7200}`));
    assertError(await tile(`layer=clouds&snapshot=${LATEST - 600 - 7800}`), 400, 'snapshot out of range');
    assert.equal(hits.length, 2);

    // Other layers keep theirs
    const precip = await tile(`layer=precip&snapshot=${LATEST}`);
    assert.equal(precip.headers.get('x-weather-snapshot'), String(LATEST));
    assertError(await tile(`layer=precip&snapshot=${LATEST - 7800}`), 400, 'snapshot out of range');
});

test('21c. an out of range snapshot never reaches the proxy; the message does not echo it', async () => {
    fresh();

    for (const snapshot of [LATEST - 7800, LATEST - 86400, 1000000200]) {
        const res = await tile(`layer=clouds&snapshot=${snapshot}`);
        assertError(res, 400, 'snapshot out of range');
        assert.ok(!res.body.toString().includes(String(snapshot)));
    }
    assert.equal(hits.length, 0);
});

test('22. a proxy 400 is a 400 for the client and is never cached', async () => {
    fresh();
    mode = '400';

    const first = await tile('layer=precip&forecast=10');
    assertError(first, 400, 'Weather upstream rejected the request');
    assert.ok(!first.body.toString().includes('UPSTREAM-BODY-SECRET'));
    assert.equal(first.headers.get('set-cookie'), null);

    mode = '400';
    assertError(await tile('layer=precip&forecast=10'), 400, 'Weather upstream rejected the request');
    assert.equal(hits.length, 2);

    // A healthy proxy answers the same request afterwards
    mode = 'ok';
    const ok = await tile('layer=precip&forecast=10');
    assertPng(ok);
    assert.equal(ok.headers.get('x-weather-cache'), 'miss');
});

test('23. pinned tiles the proxy confirms for the effective snapshot are cached for two hours', async () => {
    fresh();
    echoSnapshot = 'on';
    // Keep the layers where they are while the test clock moves
    latestByLayer = { 'precip': LATEST, 'precip-global': LATEST, 'clouds': LATEST, 'radars': LATEST };

    const query = `layer=precip&forecast=10&snapshot=${LATEST}`;
    const first = await tile(query);
    assertPng(first);
    assert.equal(first.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(first.headers.get('x-weather-cache'), 'miss');

    // Followers of a flight get the same lifetime
    const hit = await tile(query);
    assert.equal(hit.headers.get('x-weather-cache'), 'hit');
    assert.equal(hit.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(hits.length, 1);

    nowMs += 3600 * 1000;
    const hour = await tile(query);
    assert.equal(hour.headers.get('x-weather-cache'), 'hit', 'still cached after one hour');
    assert.equal(hour.headers.get('cache-control'), 'private, max-age=3600');

    nowMs += (3599 * 1000);
    assert.equal((await tile(query)).headers.get('x-weather-cache'), 'hit', 'cached until 7200 s');

    nowMs += 2 * 1000;
    const expired = await tile(query);
    assert.equal(expired.headers.get('x-weather-cache'), 'miss', 'gone after 7200 s');
    assert.equal(expired.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(hits.length, 2);

    // Concurrent callers of one flight all see the immutable lifetime
    fresh();
    echoSnapshot = 'on';
    delayMs = 100;
    const shared = await Promise.all(Array.from({ length: 4 }, () => tile(`layer=clouds&snapshot=${LATEST}`)));
    for (const res of shared) {
        assertPng(res);
        assert.equal(res.headers.get('cache-control'), 'private, max-age=3600');
    }
    assert.equal(hits.length, 1);
});

test('23b. everything else keeps the ten minute lifetime', async () => {
    const cases: Array<[string, Echo, string, number]> = [
        ['older proxy without the header', 'off', 'private, max-age=600', 600],
        ['header names another snapshot', 'mismatch', 'private, max-age=600', 600],
    ];

    for (const [name, echo, cacheControl, ttl] of cases) {
        fresh();
        latestByLayer = { 'precip': LATEST, 'precip-global': LATEST, 'clouds': LATEST, 'radars': LATEST };
        echoSnapshot = echo;
        const query = `layer=precip&snapshot=${LATEST - 600}`;

        const first = await tile(query);
        assertPng(first);
        assert.equal(first.headers.get('cache-control'), cacheControl, name);

        nowMs += (ttl - 1) * 1000;
        const hit = await tile(query);
        assert.equal(hit.headers.get('x-weather-cache'), 'hit', name);
        assert.equal(hit.headers.get('cache-control'), cacheControl, name);

        nowMs += 2 * 1000;
        assert.equal((await tile(query)).headers.get('x-weather-cache'), 'miss', `${name}: expires after ${ttl} s`);
        assert.equal(hits.length, 2, name);
    }

    // A header that matches does not make a no-store answer immutable or cacheable
    fresh();
    echoSnapshot = 'on';
    mode = 'nocache';
    const nocache = await tile('layer=precip');
    assert.equal(nocache.headers.get('cache-control'), 'private, max-age=600');
    mode = 'nocache';
    assert.equal((await tile('layer=precip')).headers.get('x-weather-cache'), 'miss');
    assert.equal(hits.length, 2);

    // Fallback tiles stay uncached with a 30 s browser lifetime, errors are refused
    fresh();
    echoSnapshot = 'on';
    mode = 'fallback';
    const fallback = await tile('layer=precip');
    assertPng(fallback);
    assert.equal(fallback.headers.get('cache-control'), 'private, max-age=30');
    mode = 'fallback';
    assert.equal((await tile('layer=precip')).headers.get('x-weather-cache'), 'miss');

    mode = 'error';
    assertError(await tile('layer=precip', { x: 9 }), 502, 'Weather upstream unavailable');
});

test('23c. a request that does not name its snapshot, or is clamped to a lagging layer, keeps the ten minute lifetime', async () => {
    // Clouds lag one step behind the other layers
    fresh();
    echoSnapshot = 'on';
    latestByLayer = { 'precip': LATEST, 'precip-global': LATEST, 'clouds': LATEST - 600, 'radars': LATEST };

    // snapshot=LATEST is newer than the layer's newest, so it is served as LATEST - 600: not pinned
    const clamped = `layer=clouds&snapshot=${LATEST}`;
    const first = await tile(clamped);
    assertPng(first);
    assert.equal(first.headers.get('x-weather-snapshot'), String(LATEST - 600));
    assert.equal(first.headers.get('cache-control'), 'private, max-age=600');

    nowMs += 599 * 1000;
    const hit = await tile(clamped);
    assert.equal(hit.headers.get('x-weather-cache'), 'hit');
    assert.equal(hit.headers.get('cache-control'), 'private, max-age=600');
    nowMs += 2 * 1000;
    assert.equal((await tile(clamped)).headers.get('x-weather-cache'), 'miss', 'the entry expired after 600 s');

    // The same layer asked for exactly its newest snapshot is pinned
    fresh();
    echoSnapshot = 'on';
    latestByLayer = { 'precip': LATEST, 'precip-global': LATEST, 'clouds': LATEST - 600, 'radars': LATEST };
    const pinned = await tile(`layer=clouds&snapshot=${LATEST - 600}`);
    assertPng(pinned);
    assert.equal(pinned.headers.get('cache-control'), 'private, max-age=3600');
    nowMs += 3600 * 1000;
    assert.equal((await tile(`layer=clouds&snapshot=${LATEST - 600}`)).headers.get('x-weather-cache'), 'hit', 'cached for 7200 s');

    // No snapshot and snapshot=latest follow the layer, so they are never long lived
    fresh();
    echoSnapshot = 'on';
    for (const query of ['layer=precip', 'layer=precip&snapshot=latest']) {
        const res = await tile(query);
        assertPng(res);
        assert.equal(res.headers.get('x-weather-snapshot'), String(LATEST), query);
        assert.equal(res.headers.get('cache-control'), 'private, max-age=600', query);
        const again = await tile(query);
        assert.equal(again.headers.get('x-weather-cache'), 'hit', query);
        assert.equal(again.headers.get('cache-control'), 'private, max-age=600', query);
    }
});

test('23d. a cache hit never gives the long browser lifetime to an unpinned request', async () => {
    // A pinned request fills the entry (7200 s)
    fresh();
    echoSnapshot = 'on';
    latestByLayer = { 'precip': LATEST, 'precip-global': LATEST, 'clouds': LATEST, 'radars': LATEST };
    const pinned = `layer=precip&snapshot=${LATEST}`;

    assert.equal((await tile(pinned)).headers.get('cache-control'), 'private, max-age=3600');
    for (const unpinned of ['layer=precip', 'layer=precip&snapshot=latest']) {
        const hit = await tile(unpinned);
        assert.equal(hit.headers.get('x-weather-cache'), 'hit', unpinned);
        assert.equal(hit.headers.get('cache-control'), 'private, max-age=600', unpinned);
    }
    const pinnedHit = await tile(pinned);
    assert.equal(pinnedHit.headers.get('x-weather-cache'), 'hit');
    assert.equal(pinnedHit.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(hits.length, 1);

    // An unpinned request fills the entry (600 s); a pinned hit is not promoted
    fresh();
    echoSnapshot = 'on';
    latestByLayer = { 'precip': LATEST, 'precip-global': LATEST, 'clouds': LATEST, 'radars': LATEST };
    assert.equal((await tile('layer=precip')).headers.get('cache-control'), 'private, max-age=600');
    const hit = await tile(pinned);
    assert.equal(hit.headers.get('x-weather-cache'), 'hit');
    assert.equal(hit.headers.get('cache-control'), 'private, max-age=600');
    nowMs += 601 * 1000;
    assert.equal((await tile(pinned)).headers.get('x-weather-cache'), 'miss', 'the entry lives 600 s');
});

test('23e. followers of one flight get the lifetime of their own request', async () => {
    fresh();
    echoSnapshot = 'on';
    delayMs = 150;

    const [leader, follower] = await (async () => {
        const first = tile(`layer=clouds&snapshot=${LATEST}`);
        // Let the leader reach the proxy before the follower arrives
        await new Promise(resolve => setTimeout(resolve, 50));
        const second = tile('layer=clouds');
        return await Promise.all([first, second]);
    })();

    assertPng(leader);
    assertPng(follower);
    assert.equal(hits.length, 1);
    assert.equal(leader.headers.get('x-weather-cache'), 'miss');
    assert.equal(follower.headers.get('x-weather-cache'), 'shared');
    assert.equal(leader.headers.get('cache-control'), 'private, max-age=3600');
    assert.equal(follower.headers.get('cache-control'), 'private, max-age=600');
});

test('24. the snapshot lookup is skipped while the upstream is paused and a 429 from it starts a pause', async () => {
    fresh();

    // A tile 429 pauses the upstream; the lookup for a layer that is not cached is not sent
    assertPng(await tile('layer=precip'));
    assert.equal(snapHits.length, 1);
    mode = '429';
    assertError(await tile('layer=precip&forecast=10'), 429);

    mode = 'ok';
    const paused = await status();
    assert.equal(paused.status, 200);
    assert.equal(snapHits.length, 1, 'no lookup while paused');
    assert.deepEqual(paused.body.latest.precip, { snapshot: LATEST, source: 'rainbow' }, 'cached values are still used');
    assert.deepEqual(paused.body.latest.clouds, { snapshot: LATEST, source: 'computed' });

    // The computed value is not cached: the next call after the pause asks the proxy
    nowMs += 7 * 1000;
    const after = await status();
    assert.equal(after.body.latest.clouds.source, 'rainbow');
    assert.equal(snapHits.length, 4);

    // The proxy rate limits the snapshot endpoint itself
    fresh();
    snapMode = '429';
    const limited = await status();
    assert.equal(limited.status, 200);
    assert.equal(limited.body.latest.clouds.source, 'computed');
    assert.ok(snapHits.length >= 1);
    const before = hits.length;
    assertError(await tile('layer=clouds', { x: 8 }), 429, 'Weather upstream is rate limiting requests');
    assert.equal(hits.length, before, 'tile misses wait for the pause');
});

test('25. the API key and session tokens stay out of logs, responses and audit lines on the snapshot paths', async () => {
    const mark = logs.length;

    fresh();
    snapMode = '500';
    echoSnapshot = 'on';
    const sessions = [flight.token.user, flight.token.admin];

    const results: Array<{ headers: Headers; text: string }> = [];
    const st = await status();
    results.push({ headers: st.headers, text: JSON.stringify(st.body) });
    for (const [query, auth] of [[`layer=clouds&snapshot=${LATEST}`, 'query'], [`layer=precip&forecast=10&snapshot=${LATEST}`, 'user'], [`layer=clouds&snapshot=${LATEST - 7800}`, 'user']] as const) {
        const res = await tile(query, { auth });
        results.push({ headers: res.headers, text: res.status === 200 ? '' : res.body.toString() });
    }

    // The snapshot lookup fails at the network level: the logged URL is redacted
    fresh({ env: { url: 'https://127.0.0.1:1/weather' } });
    const blocked = await status();
    results.push({ headers: blocked.headers, text: JSON.stringify(blocked.body) });

    for (const res of results) {
        assert.ok(!JSON.stringify([...res.headers.entries()]).includes(KEY));
        assert.ok(!res.text.includes(KEY));
        for (const session of sessions) assert.ok(!res.text.includes(session));
    }

    const mine = logs.slice(mark);
    assert.ok(mine.length > 0);
    for (const line of mine) {
        assert.ok(!line.includes(KEY), 'api key in log');
        for (const session of sessions) assert.ok(!line.includes(session), 'session token in log');
    }
    assert.ok(mine.some(l => l.includes('/snapshot?layer=') && l.includes('api=***')), 'the failing lookup is logged with the key redacted');

    const audit = mine.filter(l => l.startsWith('{') && l.includes('"type":"weather"')).map(l => JSON.parse(l));
    const served = audit.filter(a => a.status === 200);
    assert.ok(served.length >= 2);
    for (const line of served) {
        assert.equal(line.snapshot, LATEST);
        assert.equal(line.immutable, true);
        assert.ok(!('token' in line) && !('api' in line));
    }
    const refused = audit.find(a => a.status === 400);
    assert.ok(refused);
    assert.equal(refused.immutable, false);
});

test('stop upstream weather proxy', async () => {
    for (const level of ['info', 'warn', 'error'] as const) console[level] = original[level];

    upstreamAllowForTests.length = 0;
    delete process.env.WEATHER_PROXY_URL;
    delete process.env.WEATHER_PROXY_KEY;
    delete process.env.WEATHER_RATE_LIMIT;

    upstream.closeAllConnections();
    await new Promise<void>(resolve => upstream.close(() => resolve()));
});

flight.landing();
