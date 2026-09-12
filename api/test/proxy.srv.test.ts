import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false });

let upstream: http.Server;
let upstreamOrigin = '';

// 1x1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

test('start upstream proxy test server', async () => {
    upstream = http.createServer((req, res) => {
        if (req.url === '/json' && req.method === 'GET') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true, via: 'proxy' }));
            return;
        }

        if (req.url === '/image.png' && req.method === 'GET') {
            res.writeHead(200, { 'content-type': 'image/png' });
            res.end(PNG);
            return;
        }

        if (req.url === '/large.png' && req.method === 'GET') {
            res.writeHead(200, { 'content-type': 'image/png' });
            res.end(Buffer.alloc((10 * 1024 * 1024) + 1));
            return;
        }

        if (req.url === '/redirect.png' && req.method === 'GET') {
            res.writeHead(302, { location: '/image.png' });
            res.end();
            return;
        }

        if (req.url === '/large' && req.method === 'GET') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('a'.repeat((1024 * 1024) + 1));
            return;
        }

        if (req.url === '/echo' && req.method === 'POST') {
            const chunks: Buffer[] = [];
            req.on('data', chunk => chunks.push(Buffer.from(chunk)));
            req.on('end', () => {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({
                    authorization: req.headers.authorization,
                    cookie: req.headers.cookie || null,
                    body: Buffer.concat(chunks).toString('utf-8'),
                }));
            });
            return;
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });

    await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', () => resolve()));

    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine upstream address');
    upstreamOrigin = `http://127.0.0.1:${address.port}`;
});

test('PUT api/config proxy whitelist', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'proxy::enabled': true,
                'proxy::whitelist': [upstreamOrigin],
            },
        }, false);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            'proxy::enabled': true,
            'proxy::whitelist': [upstreamOrigin],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/proxy rejects when disabled', async () => {
    try {
        const disable = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'proxy::enabled': false,
                'proxy::whitelist': [upstreamOrigin],
            },
        }, false);

        assert.equal(disable.status, 200);

        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                url: `${upstreamOrigin}/json`,
                method: 'GET',
            },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Proxy is disabled');

        const enable = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'proxy::enabled': true,
                'proxy::whitelist': [upstreamOrigin],
            },
        }, false);

        assert.equal(enable.status, 200);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/proxy GET allowed origin', async () => {
    try {
        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                url: `${upstreamOrigin}/json`,
                method: 'GET',
            },
        }, false);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 200);
        assert.equal(res.body.headers['content-type'], 'application/json');
        assert.deepEqual(res.body.body, {
            ok: true,
            via: 'proxy',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/proxy forwards explicit headers only', async () => {
    try {
        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                url: `${upstreamOrigin}/echo`,
                method: 'POST',
                headers: {
                    'authorization': 'Bearer upstream-token',
                    'content-type': 'application/json',
                },
                body: {
                    ok: true,
                },
            },
        }, false);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 200);
        assert.deepEqual(res.body.body, {
            authorization: 'Bearer upstream-token',
            cookie: null,
            body: '{"ok":true}',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/proxy rejects disallowed origin', async () => {
    try {
        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                url: 'https://example.com/test',
                method: 'GET',
            },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Proxy origin https://example.com is not allowed');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/proxy rejects forbidden request headers', async () => {
    try {
        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                url: `${upstreamOrigin}/json`,
                method: 'GET',
                headers: {
                    cookie: 'nope',
                },
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Header cookie is not allowed');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/proxy rejects spoofed forwarded headers', async () => {
    try {
        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                url: `${upstreamOrigin}/json`,
                method: 'GET',
                headers: {
                    'x-forwarded-for': '1.2.3.4',
                },
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Header x-forwarded-for is not allowed');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/proxy rejects invalid whitelist entries', async () => {
    try {
        const update = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'proxy::enabled': true,
                'proxy::whitelist': [`${upstreamOrigin}/json`],
            },
        }, false);

        assert.equal(update.status, 200);

        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                url: `${upstreamOrigin}/json`,
                method: 'GET',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Whitelist entries must be origin-only (scheme + host + optional port), without path, query, fragment, or credentials');

        const reset = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'proxy::enabled': true,
                'proxy::whitelist': [upstreamOrigin],
            },
        }, false);

        assert.equal(reset.status, 200);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST api/proxy rejects oversized response bodies', async () => {
    try {
        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user,
            },
            body: {
                url: `${upstreamOrigin}/large`,
                method: 'GET',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Proxy response body exceeds the 1MB limit');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image streams an allowed image', async () => {
    try {
        const res = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent(`${upstreamOrigin}/image.png`)}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, { verify: false, json: false, binary: true });

        assert.equal(res.status, 200);
        assert.equal(res.headers.get('content-type'), 'image/png');
        assert.equal(res.headers.get('content-length'), String(PNG.byteLength));
        assert.equal(res.headers.get('cache-control'), 'private, max-age=3600');
        assert.ok(Buffer.from(res.body).equals(PNG));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image accepts a query token', async () => {
    try {
        const res = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent(`${upstreamOrigin}/image.png`)}&token=${flight.token.user}`, {
            method: 'GET',
        }, { verify: false, json: false, binary: true });

        assert.equal(res.status, 200);
        assert.equal(res.headers.get('content-type'), 'image/png');
        assert.ok(Buffer.from(res.body).equals(PNG));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image rejects unauthenticated requests', async () => {
    try {
        const res = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent(`${upstreamOrigin}/image.png`)}`, {
            method: 'GET',
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image rejects non-image responses', async () => {
    try {
        const res = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent(`${upstreamOrigin}/json`)}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Proxy image URL did not return an image');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image does not follow redirects', async () => {
    try {
        const res = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent(`${upstreamOrigin}/redirect.png`)}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 502);
        assert.equal(res.body.message, 'Proxy image upstream returned 302');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image rejects oversized images', async () => {
    try {
        const res = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent(`${upstreamOrigin}/large.png`)}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Proxy image exceeds the 10MB limit');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image is not gated by the plugin proxy toggle', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'proxy::enabled': false,
                'proxy::whitelist': [upstreamOrigin],
            },
        }, false);

        assert.equal(res.status, 200);

        const image = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent(`${upstreamOrigin}/image.png`)}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, { verify: false, json: false, binary: true });

        assert.equal(image.status, 200);
        assert.equal(image.headers.get('content-type'), 'image/png');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image blocks unsafe origins that are not whitelisted', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'proxy::enabled': false,
                'proxy::whitelist': [],
            },
        }, false);

        assert.equal(res.status, 200);

        const image = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent(`${upstreamOrigin}/image.png`)}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(image.status, 403);
        assert.equal(image.body.message, 'Blocked proxy URL: blocked IP address: 127.0.0.1');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/proxy/image rejects invalid URL', async () => {
    try {
        const res = await flight.fetch(`/api/proxy/image?url=${encodeURIComponent('not a url')}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Invalid proxy URL');
    } catch (err) {
        assert.ifError(err);
    }
});

test('stop upstream proxy test server', async () => {
    await new Promise<void>((resolve, reject) => upstream.close(err => err ? reject(err) : resolve()));
});

flight.landing();
