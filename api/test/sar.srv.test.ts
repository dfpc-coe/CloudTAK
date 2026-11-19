import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';
import { __resetForTests, upstreamAllowForTests } from '../stateless/lib/sar/relay-upstream.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false });

const KEY = 'test-sar-key-0123456789';

// Round synthetic coordinates. The upstream stub never echoes them.
const LAT = -40.123456;
const LNG = 175.654321;
const COORDS = ['40.123456', '175.654321'];

type Mode = 'ok' | 'ok-extra' | '422' | '422-suggest' | '422-junk' | '422-range' | '422-text'
    | 'dense-both' | 'dense-radius' | 'dense-hours' | 'dense-none' | 'dense-junk' | 'dense-extra'
    | '400' | '413' | '401' | '403' | '404' | '405' | '500' | '502-html' | '503' | '504-html'
    | '200-html' | '200-shape' | '302' | 'slow' | 'tarr-wrong-mode';

interface Recorded {
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: string;
}

let upstream: http.Server;
let upstreamOrigin = '';
let mode: Mode = 'ok';
const hits: Recorded[] = [];

// Everything the API writes to the console for the whole file
const logs: string[] = [];
const original = { info: console.info, warn: console.warn, error: console.error };
for (const level of ['info', 'warn', 'error'] as const) {
    console[level] = (...args: unknown[]) => {
        logs.push(args.map(a => a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a)).join(' '));
    };
}

const RESULT = {
    status: 'ok',
    mode: 'travel-time',
    contours: {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: { hours: 1, label: '1.0h', color: '#ff0000', label_lat: -40, label_lng: 175 },
            geometry: { type: 'Polygon', coordinates: [[[175, -40], [175.1, -40], [175.1, -40.1], [175, -40]]] },
        }],
    },
    parameters: { speed_kmh: 2.5, intervals_hours: [1], radius_km: 10, cell_size_m: 30 },
    bbox: { west: 174.9, south: -40.2, east: 175.2, north: -39.9 },
    warnings: [{ severity: 'info', source: 'bands', message: 'ok' }],
    data: { land_cover: 'LCDB', elevation: 'DEM', osm_built_at: null },
    attribution: ['LCDB'],
    disclaimer: 'Planning aid only.',
    timings_s: { total: 1.5 },
};

const RESULT_TARR = {
    status: 'ok',
    mode: 'tarr',
    contours: {
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: { kind: 'plain', percent: 75, label: 'Koester 75%, plain circle', color: '#fbc02d', koester_km: 3.22, distance_km: 3.22, label_lat: -40, label_lng: 175 },
            geometry: { type: 'Polygon', coordinates: [[[175, -40], [175.1, -40], [175.1, -40.1], [175, -40]]] },
        }],
    },
    parameters: {
        profile: 'Hiker',
        ecoregion: null,
        terrain: null,
        koester_km: { p25: 0.64, p50: 1.77, p75: 3.22 },
        calibrated_km: { p25: 0.736, p50: 2.036, p75: 3.703 },
        radius_km: 5.7,
        cell_size_m: 12.5,
    },
    calibration: {
        region: 'Coconino County, Arizona',
        source: 'built-in',
        profile_specific: true,
        multiplier: { p25: 1.15, p50: 1.15, p75: 1.15 },
        calibrated_for_nz: false,
        note: 'Not calibrated for New Zealand.',
    },
    bbox: { west: 174.9, south: -40.2, east: 175.2, north: -39.9 },
    warnings: [{ severity: 'info', source: 'resolution', message: 'ok' }],
    data: { land_cover: 'LCDB', elevation: 'DEM', osm_built_at: null },
    attribution: ['LCDB', 'Subject distances: Koester (2008)'],
    disclaimer: 'Planning aid only.',
    timings_s: { total: 1.5 },
};

function configure(opts: { url?: string | null; key?: string | null; rate?: string | null } = {}) {
    const set = (name: string, value: string | null | undefined, fallback: string | null) => {
        const v = value === undefined ? fallback : value;
        if (v === null) {
            delete process.env[name];
        } else {
            process.env[name] = v;
        }
    };

    set('SAR_SERVICE_URL', opts.url, `${upstreamOrigin}/sar`);
    set('SAR_SERVICE_KEY', opts.key, KEY);
    set('SAR_RATE_LIMIT', opts.rate, null);
}

function fresh(opts: { env?: Parameters<typeof configure>[0]; upstreamTimeoutMs?: number; now?: () => number } = {}) {
    mode = 'ok';
    hits.length = 0;
    configure(opts.env);
    __resetForTests({ now: opts.now, upstreamTimeoutMs: opts.upstreamTimeoutMs });
}

function validBody(over: Record<string, unknown> = {}): Record<string, unknown> {
    return { ipp: { lat: LAT, lng: LNG }, speed_kmh: 2.5, intervals_hours: [4, 1, 2, 2], radius_km: 10, ...over };
}

interface Answer {
    status: number;
    headers: Headers;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    text: string;
}

async function post(body: unknown, auth: string = 'user', url = '/api/sar/travel-time'): Promise<Answer> {
    const req: { method: string; headers: Record<string, string>; body: unknown; auth?: { bearer: string } } = {
        method: 'POST',
        headers: {},
        body,
    };
    if (auth === 'user' || auth === 'admin') {
        req.auth = { bearer: flight.token[auth] };
    } else if (auth !== 'none') {
        req.auth = { bearer: auth };
    }

    return await send(url, req);
}

async function postTarr(body: unknown, auth: string = 'user'): Promise<Answer> {
    return await post(body, auth, '/api/sar/tarr');
}

function tarrBody(over: Record<string, unknown> = {}): Record<string, unknown> {
    return { ipp: { lat: LAT, lng: LNG }, profile: 'Hiker', ...over };
}

async function status(auth: string = 'user'): Promise<Answer> {
    const req: { method: string; headers: Record<string, string>; auth?: { bearer: string } } = { method: 'GET', headers: {} };
    if (auth === 'user') {
        req.auth = { bearer: flight.token.user };
    } else if (auth !== 'none') {
        req.auth = { bearer: auth };
    }

    return await send('/api/sar/status', req);
}

function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

async function send(url: string, req: { method: string; headers: Record<string, string>; body?: unknown; auth?: { bearer: string } }): Promise<Answer> {
    const res = await flight.fetch(url, req, { json: false });
    const text = String(res.body);
    const answer: Answer = { status: res.status, headers: res.headers as Headers, body: parseJson(text), text };

    // Every answer is uncacheable
    assert.equal(answer.headers.get('cache-control'), 'no-store', `${url} ${answer.status}`);
    // Nothing from the upstream and nothing secret is passed on
    assert.equal(answer.headers.get('x-upstream-leak'), null);
    assert.equal(answer.headers.get('set-cookie'), null);
    assert.ok(!JSON.stringify([...answer.headers.entries()]).includes(KEY));
    assert.ok(!answer.text.includes(KEY));
    assert.ok(!answer.text.includes('UPSTREAM-BODY-SECRET'));
    for (const token of Object.values(flight.token)) {
        assert.ok(!answer.text.includes(token), 'session token in response');
        assert.ok(!JSON.stringify([...answer.headers.entries()]).includes(token), 'session token in headers');
    }
    for (const coord of COORDS) assert.ok(!answer.text.includes(coord), 'coordinate in response');

    return answer;
}

function assertError(res: Answer, code: number, message?: string) {
    assert.equal(res.status, code, res.text);
    if (message !== undefined) assert.equal(res.body.message, message);
    assert.equal(res.body.status, code);
    assert.deepEqual(res.body.messages ?? [], []);
}

test('start upstream SAR engine', async () => {
    upstream = http.createServer((req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
            hits.push({
                method: String(req.method),
                url: String(req.url),
                headers: req.headers,
                body: Buffer.concat(chunks).toString('utf8'),
            });

            const base = { 'x-upstream-leak': 'yes', 'set-cookie': 'upstream=1' };
            const json = (code: number, payload: unknown, extra: Record<string, string> = {}) => {
                res.writeHead(code, { ...base, 'content-type': 'application/json', ...extra });
                res.end(JSON.stringify(payload));
            };
            const html = (code: number) => {
                res.writeHead(code, { ...base, 'content-type': 'text/html' });
                res.end('<html><body>UPSTREAM-BODY-SECRET</body></html>');
            };

            const tarr = String(req.url).endsWith('/tarr');
            switch (mode) {
                case 'ok':
                    json(200, tarr ? RESULT_TARR : RESULT);
                    return;
                case 'ok-extra':
                    json(200, { ...(tarr ? RESULT_TARR : RESULT), secret: 'UPSTREAM-BODY-SECRET', trace: '/var/task/handler.py' });
                    return;
                case 'tarr-wrong-mode':
                    json(200, tarr ? RESULT : RESULT_TARR);
                    return;
                case '422':
                    json(422, { status: 'error', message: 'The start point is in the sea or open water. Move it onto land.' });
                    return;
                case '422-suggest':
                    json(422, { status: 'error', message: 'This area is too dense.', suggested_radius_km: 7.25 });
                    return;
                case '422-junk':
                    json(422, { status: 'error', message: `bad\u0000\u0007text\n${'x'.repeat(400)}`, suggested_radius_km: 'big' });
                    return;
                case '422-range':
                    json(422, { status: 'error', message: 'Out of range.', suggested_radius_km: 500 });
                    return;
                case 'dense-both':
                    json(422, { status: 'error', code: 'area_too_dense', message: 'Dense area.', suggested_radius_km: 17, suggested_max_hours: 4.5 });
                    return;
                case 'dense-radius':
                    json(422, { status: 'error', code: 'area_too_dense', message: 'Dense area.', suggested_radius_km: 17 });
                    return;
                case 'dense-hours':
                    json(422, { status: 'error', code: 'area_too_dense', message: 'Dense area.', suggested_max_hours: 4.5 });
                    return;
                case 'dense-none':
                    json(422, { status: 'error', code: 'area_too_dense', message: 'Dense area.' });
                    return;
                case 'dense-junk':
                    json(422, { status: 'error', code: 'area_too_dense', message: 'Dense area.', suggested_radius_km: '17', suggested_max_hours: null });
                    return;
                case 'dense-extra':
                    json(422, { status: 'error', code: 'area_too_dense', message: 'Dense area.', suggested_radius_km: 17, trace: 'UPSTREAM-BODY-SECRET', ipp: { lat: -40.123456, lng: 175.654321 } });
                    return;
                case '422-text':
                    html(422);
                    return;
                case '200-html':
                    html(200);
                    return;
                case '200-shape':
                    json(200, { status: 'ok', mode: tarr ? 'tarr' : 'travel-time', contours: 'none', secret: 'UPSTREAM-BODY-SECRET' });
                    return;
                case '502-html':
                    html(502);
                    return;
                case '504-html':
                    html(504);
                    return;
                case '302':
                    res.writeHead(302, { ...base, location: '/elsewhere' });
                    res.end();
                    return;
                case 'slow':
                    setTimeout(() => json(200, tarr ? RESULT_TARR : RESULT), 1500).unref();
                    return;
                default:
                    json(Number(mode), { status: 'error', message: 'UPSTREAM-BODY-SECRET' });
            }
        });
    });

    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', () => resolve()));
    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine upstream address');
    upstreamOrigin = `http://127.0.0.1:${address.port}`;
    upstreamAllowForTests.push(upstreamOrigin);
});

test('1. authentication is required on every endpoint', async () => {
    fresh();

    assertError(await status('none'), 401);
    assertError(await status('garbage'), 401);
    assertError(await post(validBody(), 'none'), 401);
    assertError(await post(validBody(), 'garbage'), 401);
    assertError(await postTarr(tarrBody(), 'none'), 401);
    assertError(await postTarr(tarrBody(), 'garbage'), 401);

    // A resource token is not a user session
    const resource = jwt.sign({ access: 'data', id: 1, internal: true }, 'coe-wildland-fire');
    const refused = await post(validBody(), `etl.${resource}`);
    assert.ok([401, 403].includes(refused.status), `resource token refused (${refused.status})`);

    assert.equal(hits.length, 0, 'upstream untouched');
});

test('2. status reports the relay as disabled without calling the upstream', async () => {
    const cases: Array<Parameters<typeof configure>[0]> = [
        { url: null },
        { key: null },
        { url: null, key: null },
        { url: 'not a url' },
        { url: 'http://sar.example.com/sar' },
        { key: 'short' },
        { key: 'has spaces in the key 012345' },
    ];

    for (const env of cases) {
        fresh({ env });
        const res = await status();
        assert.equal(res.status, 200, JSON.stringify(env));
        assert.deepEqual(res.body, { apiVersion: 1, enabled: false, modes: ['travel-time', 'tarr'] }, JSON.stringify(env));
        assert.equal(hits.length, 0);
    }
});

test('3. status reports the relay as enabled; configuration is read on every request', async () => {
    fresh();

    assert.deepEqual((await status()).body, { apiVersion: 1, enabled: true, modes: ['travel-time', 'tarr'] });
    assert.equal(hits.length, 0, 'status never calls the upstream');

    configure({ key: null });
    assert.deepEqual((await status()).body, { apiVersion: 1, enabled: false, modes: ['travel-time', 'tarr'] });

    configure();
    assert.deepEqual((await status()).body, { apiVersion: 1, enabled: true, modes: ['travel-time', 'tarr'] });
});

test('4. status is limited to 60 calls a minute per user', async () => {
    let nowMs = 1800000000000;
    fresh({ now: () => nowMs });

    for (let i = 1; i <= 60; i++) {
        assert.equal((await status()).status, 200, `call ${i}`);
    }

    const denied = await status();
    assertError(denied, 429);
    const wait = Number(denied.headers.get('retry-after'));
    assert.ok(wait >= 1 && wait <= 60, `retry-after ${wait}`);

    nowMs += 60000;
    assert.equal((await status()).status, 200);
});

test('5. success forwards exactly the validated request and only the whitelisted answer', async () => {
    fresh();
    mode = 'ok-extra';

    const res = await post(validBody());
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.body, RESULT);
    assert.ok(!('secret' in res.body) && !('trace' in res.body));

    assert.equal(hits.length, 1);
    const hit = hits[0];
    assert.equal(hit.method, 'POST');
    assert.equal(hit.url, '/sar/travel-time');
    assert.equal(hit.headers['x-api-key'], KEY);
    assert.equal(hit.headers['content-type'], 'application/json');
    assert.ok(String(hit.headers['user-agent']).startsWith('CloudTAK/'));
    assert.equal(hit.headers.authorization, undefined, 'the session token is not forwarded');
    assert.deepEqual(JSON.parse(hit.body), {
        ipp: { lat: LAT, lng: LNG },
        speed_kmh: 2.5,
        intervals_hours: [1, 2, 4],
        radius_km: 10,
    });
});

test('5b. a request without radius omits it upstream', async () => {
    fresh();
    const body = validBody();
    delete body.radius_km;

    assert.equal((await post(body)).status, 200);
    assert.deepEqual(Object.keys(JSON.parse(hits[0].body)).sort(), ['intervals_hours', 'ipp', 'speed_kmh']);
});

test('5c. the other user is served too and the base URL may be given with a trailing slash', async () => {
    fresh({ env: { url: `${upstreamOrigin}/sar/` } });
    assert.equal((await post(validBody(), 'admin')).status, 200);
    assert.equal(hits[0].url, '/sar/travel-time');
});

test('6. validation answers 400 before the upstream, at both ends of every bound', async () => {
    fresh({ env: { rate: '60' } });

    const good: Array<Record<string, unknown>> = [
        { ipp: { lat: -48, lng: 165.5 } },
        { ipp: { lat: -33.5, lng: 179.5 } },
        { speed_kmh: 0.1 },
        { speed_kmh: 10 },
        { intervals_hours: [0.25] },
        { intervals_hours: [24] },
        { intervals_hours: [1, 2, 3, 4, 5, 6, 7, 8] },
        { radius_km: 1 },
        { radius_km: 30 },
    ];
    for (const over of good) {
        const res = await post(validBody(over));
        assert.equal(res.status, 200, JSON.stringify(over));
    }
    assert.equal(hits.length, good.length);
    hits.length = 0;

    const bad: Array<Record<string, unknown>> = [
        { ipp: { lat: -48.01, lng: 175 } },
        { ipp: { lat: -33.49, lng: 175 } },
        { ipp: { lat: -40, lng: 165.49 } },
        { ipp: { lat: -40, lng: 179.51 } },
        { ipp: { lat: 'north', lng: 175 } },
        { ipp: { lat: -40 } },
        { ipp: null },
        { speed_kmh: 0.09 },
        { speed_kmh: 10.01 },
        { speed_kmh: 'fast' },
        { intervals_hours: [0.24] },
        { intervals_hours: [24.01] },
        { intervals_hours: [] },
        { intervals_hours: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
        { intervals_hours: ['one'] },
        { radius_km: 0.99 },
        { radius_km: 30.01 },
        { radius_km: 'wide' },
        { radius_km: null },
        { speed_kmh: null },
    ];
    for (const over of bad) {
        const res = await post(validBody(over));
        assert.equal(res.status, 400, JSON.stringify(over));
        assert.equal(res.headers.get('cache-control'), 'no-store');
    }

    // Missing required fields
    for (const name of ['ipp', 'speed_kmh', 'intervals_hours']) {
        const body = validBody();
        delete body[name];
        assert.equal((await post(body)).status, 400, name);
    }

    assert.equal(hits.length, 0, 'invalid requests never reach the upstream');
});

test('7. a body over 8 KB is a 413 and never reaches the upstream', async () => {
    fresh();

    const padded = await post(validBody({ pad: 'x'.repeat(9000) }));
    assertError(padded, 413, 'Request too large');

    const arrays = await post(validBody({ intervals_hours: Array.from({ length: 5000 }, () => 1) }));
    assertError(arrays, 413, 'Request too large');

    assert.equal(hits.length, 0);

    // Just under the cap is served; the platform validator drops the unknown key
    const under = await post(validBody({ pad: 'x'.repeat(4000) }));
    assert.equal(under.status, 200);
    assert.equal(hits.length, 1);
    assert.ok(!('pad' in JSON.parse(hits[0].body)));
});

test('7b. unknown keys never reach the upstream', async () => {
    fresh();

    const res = await post(validBody({ extra: true, ipp: { lat: LAT, lng: LNG, alt: 1 } }));
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(hits[0].body), {
        ipp: { lat: LAT, lng: LNG },
        speed_kmh: 2.5,
        intervals_hours: [1, 2, 4],
        radius_km: 10,
    });
});

test('8. upstream error mapping', async () => {
    fresh({ env: { rate: '60' } });

    const cases: Array<[Mode, number, string, string | null]> = [
        ['422', 422, 'The start point is in the sea or open water. Move it onto land.', null],
        ['400', 400, 'The SAR service rejected the request', null],
        ['413', 413, 'Request too large', null],
        ['401', 502, 'SAR service unavailable', null],
        ['403', 502, 'SAR service unavailable', null],
        ['404', 502, 'SAR service unavailable', null],
        ['405', 502, 'SAR service unavailable', null],
        ['500', 500, 'Analysis failed. Try again, or try a smaller area.', null],
        ['502-html', 504, 'SAR service timed out', '30'],
        ['503', 504, 'SAR service timed out', '30'],
        ['504-html', 504, 'SAR service timed out', '30'],
        ['200-html', 502, 'SAR service unavailable', null],
        ['200-shape', 502, 'SAR service unavailable', null],
        ['422-text', 502, 'SAR service unavailable', null],
        ['302', 502, 'SAR service unavailable', null],
    ];

    for (const [m, code, message, retry] of cases) {
        mode = m;
        const before = hits.length;
        const res = await post(validBody(), 'admin');
        assertError(res, code, message);
        assert.equal(res.headers.get('retry-after'), retry, m);
        assert.equal(hits.length, before + 1, m);
    }

    // Plain 502 JSON from the upstream is a 504 too
    mode = '502-html';
    assert.equal((await post(validBody(), 'admin')).status, 504);
});

test('8b. a 422 carries a sanitised message and a valid suggested radius', async () => {
    fresh();

    mode = '422-suggest';
    const suggest = await post(validBody());
    assert.equal(suggest.status, 422);
    assert.deepEqual(suggest.body, {
        status: 422,
        message: 'This area is too dense.',
        suggested_radius_km: 7.3,
        messages: [],
    });

    mode = '422';
    const plain = await post(validBody());
    assert.equal(plain.status, 422);
    assert.ok(!('suggested_radius_km' in plain.body));

    mode = '422-junk';
    const junk = await post(validBody());
    assert.equal(junk.status, 422);
    assert.equal(junk.body.message.length, 300);
    // eslint-disable-next-line no-control-regex
    assert.ok(!/[\u0000-\u001F]/.test(junk.body.message));
    assert.ok(junk.body.message.startsWith('badtext'));
    assert.ok(!('suggested_radius_km' in junk.body));

    mode = '422-range';
    const range = await post(validBody());
    assert.equal(range.status, 422);
    assert.equal(range.body.message, 'Out of range.');
    assert.ok(!('suggested_radius_km' in range.body));
});

test('8c. area_too_dense passes the code and only valid suggestions', async () => {
    fresh({ env: { rate: '60' } });
    const expected: Array<[Mode, Record<string, unknown>]> = [
        ['dense-both', { code: 'area_too_dense', suggested_radius_km: 17, suggested_max_hours: 4.5 }],
        ['dense-radius', { code: 'area_too_dense', suggested_radius_km: 17 }],
        ['dense-hours', { code: 'area_too_dense', suggested_max_hours: 4.5 }],
        ['dense-none', { code: 'area_too_dense' }],
        ['dense-junk', { code: 'area_too_dense' }],
        ['dense-extra', { code: 'area_too_dense', suggested_radius_km: 17 }],
    ];
    for (const [m, fields] of expected) {
        mode = m;
        const res = await post(validBody());
        assert.equal(res.status, 422, m);
        assert.deepEqual(res.body, { status: 422, message: 'Dense area.', ...fields, messages: [] }, m);
    }
    // A 422 without a code carries no code
    mode = '422';
    const plain = await post(validBody());
    assert.equal(plain.status, 422);
    assert.ok(!('code' in plain.body));
});
test('9. a slow upstream is a 504 with Retry-After', async () => {
    fresh({ upstreamTimeoutMs: 200 });
    mode = 'slow';

    const res = await post(validBody());
    assertError(res, 504, 'SAR service timed out');
    assert.equal(res.headers.get('retry-after'), '30');
});

test('10. a refused connection and a blocked address are a 502', async () => {
    // A port nobody listens on
    const probe = http.createServer();
    await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', () => resolve()));
    const address = probe.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine probe address');
    const closed = `http://127.0.0.1:${address.port}`;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    upstreamAllowForTests.push(closed);

    fresh({ env: { url: `${closed}/sar` } });
    assertError(await post(validBody()), 502, 'SAR service unavailable');

    // https to a private address is refused by the SSRF guard before any connection
    fresh({ env: { url: 'https://127.0.0.1:1/sar' } });
    assertError(await post(validBody()), 502, 'SAR service unavailable');
    assert.equal(hits.length, 0);
});

test('11. a disabled or misconfigured relay is a 502 without an upstream call', async () => {
    for (const env of [{ url: null }, { key: null }, { url: 'nope' }, { key: 'short' }]) {
        fresh({ env });
        assertError(await post(validBody()), 502, 'SAR service unavailable');
        assert.equal(hits.length, 0);
    }
});

test('12. per user rate limit with a fixed window', async () => {
    let nowMs = 1800000000000;
    fresh({ env: { rate: '2' }, now: () => nowMs });

    assert.equal((await post(validBody())).status, 200);
    assert.equal((await post(validBody())).status, 200);

    const denied = await post(validBody());
    assertError(denied, 429, 'Too many SAR requests');
    const first = Number(denied.headers.get('retry-after'));
    assert.ok(first >= 1 && first <= 60, `retry-after ${first}`);
    assert.equal(hits.length, 2, 'a limited request never reaches the upstream');

    // The second user is unaffected
    assert.equal((await post(validBody(), 'admin')).status, 200);

    // A later hit does not extend the window
    nowMs += 30000;
    const second = Number((await post(validBody())).headers.get('retry-after'));
    assert.ok(second >= 1 && second < first, `retry-after ${second} < ${first}`);

    nowMs += 30000;
    assert.equal((await post(validBody())).status, 200);
});

test('12b. the default rate is 6 a minute', async () => {
    fresh();
    for (let i = 1; i <= 6; i++) {
        assert.equal((await post(validBody())).status, 200, `call ${i}`);
    }
    assertError(await post(validBody()), 429);
});

test('12c. an invalid SAR_RATE_LIMIT falls back to 6 a minute', async () => {
    fresh({ env: { rate: '1000' } });
    for (let i = 1; i <= 6; i++) {
        assert.equal((await post(validBody())).status, 200, `call ${i}`);
    }
    assertError(await post(validBody()), 429);
});

test('13. the key, session tokens and coordinates stay out of logs, responses and audit lines', async () => {
    fresh({ env: { rate: '60' } });
    const start = logs.length;

    for (const m of ['401', '500', '422', 'dense-both', 'dense-extra', '502-html', '200-html', 'ok'] as Mode[]) {
        mode = m;
        await post(validBody(), 'admin');
    }
    configure({ url: 'not a url', key: 'bad key' });
    await post(validBody(), 'admin');
    await status();
    configure({ rate: 'many' });
    await post(validBody(), 'admin');
    configure({ rate: '60' });
    await post(validBody({ pad: 'x'.repeat(9000) }), 'admin');
    await post(validBody(), 'none');
    // A schema failure carries the coordinates in the request; they must not be logged
    assert.equal((await post(validBody({ speed_kmh: 99 }), 'admin')).status, 400);

    assert.ok(logs.length > 0);
    const sessions = Object.values(flight.token);
    for (const line of logs) {
        assert.ok(!line.includes(KEY), 'api key in log');
        assert.ok(!line.includes('UPSTREAM-BODY-SECRET'), 'upstream body in log');
        for (const session of sessions) assert.ok(!line.includes(session), 'session token in log');
        for (const coord of COORDS) assert.ok(!line.includes(coord), 'coordinate in log');
        assert.ok(!/bearer\s+[A-Za-z0-9._~+/=-]{10,}/i.test(line), 'bearer token in log');
    }

    const audit = logs.slice(start).filter(l => l.startsWith('{') && l.includes('"type":"sar"'));
    assert.ok(audit.length >= 6);
    for (const line of audit) {
        const parsed = JSON.parse(line);
        assert.deepEqual(Object.keys(parsed).sort(), ['intervals', 'ms', 'radius_km', 'speed_kmh', 'status', 'type', 'upstream', 'username']);
        assert.equal(parsed.type, 'sar');
        assert.equal(typeof parsed.ms, 'number');
    }

    const successes = audit.map(l => JSON.parse(l)).filter(p => p.status === 200);
    assert.ok(successes.length >= 1);
    assert.equal(successes[0].username, 'admin@example.com');
    assert.equal(successes[0].speed_kmh, 2.5);
    assert.equal(successes[0].intervals, 4);
    assert.equal(successes[0].radius_km, 10);
    assert.equal(successes[0].upstream, 200);

    const rejectedKey = logs.slice(start).filter(l => l.includes('rejected the configured API key'));
    assert.equal(rejectedKey.length, 1, 'a rejected key is logged once a minute');
});

test('14. error answers use the platform error shape', async () => {
    fresh();
    mode = '500';
    const res = await post(validBody());
    assert.deepEqual(res.body, { status: 500, message: 'Analysis failed. Try again, or try a smaller area.', messages: [] });
});

test('15. TARR success forwards exactly the validated request and only the whitelisted answer', async () => {
    fresh();
    mode = 'ok-extra';
    const res = await postTarr(tarrBody({ ecoregion: 'Temperate', terrain: 'Mountainous' }));
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.body, RESULT_TARR);
    assert.ok('calibration' in res.body);
    assert.ok(!('secret' in res.body) && !('trace' in res.body));
    assert.equal(hits.length, 1);
    const hit = hits[0];
    assert.equal(hit.method, 'POST');
    assert.equal(hit.url, '/sar/tarr');
    assert.equal(hit.headers['x-api-key'], KEY);
    assert.equal(hit.headers['content-type'], 'application/json');
    assert.ok(String(hit.headers['user-agent']).startsWith('CloudTAK/'));
    assert.equal(hit.headers.authorization, undefined, 'the session token is not forwarded');
    assert.deepEqual(JSON.parse(hit.body), {
        ipp: { lat: LAT, lng: LNG },
        profile: 'Hiker',
        ecoregion: 'Temperate',
        terrain: 'Mountainous',
    });
});

test('15b. TARR without the optional fields forwards only ipp and profile; unknown keys are dropped', async () => {
    fresh();
    const res = await postTarr(tarrBody({ extra: true, pad: 'x'.repeat(4000), ipp: { lat: LAT, lng: LNG, alt: 1 } }), 'admin');
    assert.equal(res.status, 200, res.text);
    assert.equal(hits[0].url, '/sar/tarr');
    assert.deepEqual(JSON.parse(hits[0].body), { ipp: { lat: LAT, lng: LNG }, profile: 'Hiker' });
});

test('16. TARR validation answers 400 before the upstream', async () => {
    fresh({ env: { rate: '60' } });
    const good: Array<Record<string, unknown>> = [
        { ipp: { lat: -48, lng: 165.5 } },
        { ipp: { lat: -33.5, lng: 179.5 } },
        { profile: 'a' },
        { profile: 'a'.repeat(40) },
        { profile: 'Skier (Alpine)' },
        { ecoregion: 'Dry', terrain: 'Flat' },
    ];
    for (const over of good) {
        assert.equal((await postTarr(tarrBody(over))).status, 200, JSON.stringify(over));
    }
    assert.equal(hits.length, good.length);
    hits.length = 0;
    const bad: Array<Record<string, unknown>> = [
        { ipp: { lat: -48.01, lng: 175 } },
        { ipp: { lat: -33.49, lng: 175 } },
        { ipp: { lat: -40, lng: 165.49 } },
        { ipp: { lat: -40, lng: 179.51 } },
        { ipp: { lat: 'north', lng: 175 } },
        { ipp: { lat: -40 } },
        { ipp: null },
        { profile: '' },
        { profile: 'a'.repeat(41) },
        { profile: 'a<b' },
        { profile: 'a;b' },
        { profile: 'a\nb' },
        { profile: null },
        { ecoregion: null },
        { ecoregion: '' },
        { ecoregion: 'Dry;' },
        { terrain: 'a'.repeat(21) },
    ];
    // The platform validator coerces numbers and booleans to text; the schema itself is strict (sar-relay-lib.test.ts)
    for (const over of bad) {
        const res = await postTarr(tarrBody(over));
        assert.equal(res.status, 400, JSON.stringify(over));
        assert.equal(res.headers.get('cache-control'), 'no-store');
    }
    const noProfile = tarrBody();
    delete noProfile.profile;
    assert.equal((await postTarr(noProfile)).status, 400, 'missing profile');
    const noIpp = tarrBody();
    delete noIpp.ipp;
    assert.equal((await postTarr(noIpp)).status, 400, 'missing ipp');
    assert.equal(hits.length, 0, 'invalid requests never reach the upstream');
});

test('17. a TARR body over 8 KB is a 413 and never reaches the upstream', async () => {
    fresh();
    assertError(await postTarr(tarrBody({ pad: 'x'.repeat(9000) })), 413, 'Request too large');
    assertError(await postTarr(tarrBody({ profile: 'x'.repeat(9000) })), 413, 'Request too large');
    assert.equal(hits.length, 0);
});

test('18. TARR upstream error mapping', async () => {
    fresh({ env: { rate: '60' } });
    const cases: Array<[Mode, number, string, string | null]> = [
        ['422', 422, 'The start point is in the sea or open water. Move it onto land.', null],
        ['400', 400, 'The SAR service rejected the request', null],
        ['413', 413, 'Request too large', null],
        ['401', 502, 'SAR service unavailable', null],
        ['403', 502, 'SAR service unavailable', null],
        ['404', 502, 'SAR service unavailable', null],
        ['500', 500, 'Analysis failed. Try again, or try a smaller area.', null],
        ['502-html', 504, 'SAR service timed out', '30'],
        ['503', 504, 'SAR service timed out', '30'],
        ['504-html', 504, 'SAR service timed out', '30'],
        ['200-html', 502, 'SAR service unavailable', null],
        ['200-shape', 502, 'SAR service unavailable', null],
        ['tarr-wrong-mode', 502, 'SAR service unavailable', null],
        ['422-text', 502, 'SAR service unavailable', null],
        ['302', 502, 'SAR service unavailable', null],
    ];
    for (const [m, code, message, retry] of cases) {
        mode = m;
        const before = hits.length;
        const res = await postTarr(tarrBody(), 'admin');
        assertError(res, code, message);
        assert.equal(res.headers.get('retry-after'), retry, m);
        assert.equal(hits.length, before + 1, m);
        assert.equal(hits[hits.length - 1].url, '/sar/tarr', m);
    }
});

test('18b. a TARR 422 carries the code and a sanitised message, with and without a code', async () => {
    fresh({ env: { rate: '60' } });
    mode = 'dense-none';
    const dense = await postTarr(tarrBody());
    assert.deepEqual(dense.body, { status: 422, message: 'Dense area.', code: 'area_too_dense', messages: [] });
    mode = 'dense-extra';
    const extra = await postTarr(tarrBody());
    assert.equal(extra.status, 422);
    assert.ok(!('ipp' in extra.body) && !('trace' in extra.body));
    mode = '422';
    const plain = await postTarr(tarrBody());
    assert.equal(plain.status, 422);
    assert.ok(!('code' in plain.body));
});

test('18c. a slow upstream on the TARR route is a 504 with Retry-After', async () => {
    fresh({ upstreamTimeoutMs: 200 });
    mode = 'slow';
    const res = await postTarr(tarrBody());
    assertError(res, 504, 'SAR service timed out');
    assert.equal(res.headers.get('retry-after'), '30');
});

test('19. a disabled or misconfigured relay is a 502 on the TARR route without an upstream call', async () => {
    for (const env of [{ url: null }, { key: null }, { url: 'nope' }, { key: 'short' }]) {
        fresh({ env });
        assertError(await postTarr(tarrBody()), 502, 'SAR service unavailable');
        assert.equal(hits.length, 0);
    }
});

test('20. travel-time and TARR share one per user rate limit', async () => {
    let nowMs = 1800000000000;
    fresh({ env: { rate: '2' }, now: () => nowMs });
    assert.equal((await post(validBody())).status, 200);
    assert.equal((await postTarr(tarrBody())).status, 200);
    const deniedTarr = await postTarr(tarrBody());
    assertError(deniedTarr, 429, 'Too many SAR requests');
    const wait = Number(deniedTarr.headers.get('retry-after'));
    assert.ok(wait >= 1 && wait <= 60, `retry-after ${wait}`);
    const deniedTravel = await post(validBody());
    assertError(deniedTravel, 429, 'Too many SAR requests');
    assert.ok(deniedTravel.headers.get('retry-after'));
    assert.equal(hits.length, 2, 'a limited request never reaches the upstream');
    // The other user is unaffected and the window ends
    assert.equal((await postTarr(tarrBody(), 'admin')).status, 200);
    nowMs += 60000;
    assert.equal((await postTarr(tarrBody())).status, 200);
});

test('21. the TARR route keeps the key, tokens and coordinates out of logs and audit lines', async () => {
    fresh({ env: { rate: '60' } });
    const start = logs.length;
    for (const m of ['401', '500', '422', 'dense-extra', '502-html', '200-html', 'tarr-wrong-mode', 'ok'] as Mode[]) {
        mode = m;
        await postTarr(tarrBody({ profile: 'Hiker' }), 'admin');
    }
    configure({ url: 'not a url', key: 'bad key' });
    await postTarr(tarrBody(), 'admin');
    configure({ rate: '60' });
    await postTarr(tarrBody({ pad: 'x'.repeat(9000) }), 'admin');
    await postTarr(tarrBody(), 'none');
    // A schema failure carries the coordinates in the request; they must not be logged
    assert.equal((await postTarr(tarrBody({ profile: '<script>' }), 'admin')).status, 400);
    const lines = logs.slice(start);
    assert.ok(lines.length > 0);
    const sessions = Object.values(flight.token);
    for (const line of lines) {
        assert.ok(!line.includes(KEY), 'api key in log');
        assert.ok(!line.includes('UPSTREAM-BODY-SECRET'), 'upstream body in log');
        for (const session of sessions) assert.ok(!line.includes(session), 'session token in log');
        for (const coord of COORDS) assert.ok(!line.includes(coord), 'coordinate in log');
        assert.ok(!/bearer\s+[A-Za-z0-9._~+/=-]{10,}/i.test(line), 'bearer token in log');
    }
    const audit = lines.filter(l => l.startsWith('{') && l.includes('"type":"sar"'));
    assert.ok(audit.length >= 6);
    for (const line of audit) {
        const parsed = JSON.parse(line);
        assert.deepEqual(Object.keys(parsed).sort(), ['mode', 'ms', 'profile', 'status', 'type', 'upstream', 'username']);
        assert.equal(parsed.mode, 'tarr');
        assert.equal(typeof parsed.ms, 'number');
    }
    const successes = audit.map(l => JSON.parse(l)).filter(p => p.status === 200);
    assert.equal(successes.length, 1);
    assert.equal(successes[0].username, 'admin@example.com');
    assert.equal(successes[0].profile, 'Hiker');
    assert.equal(successes[0].upstream, 200);
});

test('22. TARR error answers use the platform error shape', async () => {
    fresh();
    mode = '500';
    const res = await postTarr(tarrBody());
    assert.deepEqual(res.body, { status: 500, message: 'Analysis failed. Try again, or try a smaller area.', messages: [] });
});

test('stop upstream SAR engine', async () => {
    for (const level of ['info', 'warn', 'error'] as const) console[level] = original[level];
    upstreamAllowForTests.length = 0;
    delete process.env.SAR_SERVICE_URL;
    delete process.env.SAR_SERVICE_KEY;
    delete process.env.SAR_RATE_LIMIT;
    upstream.closeAllConnections();
    await new Promise<void>(resolve => upstream.close(() => resolve()));
});

flight.landing();
