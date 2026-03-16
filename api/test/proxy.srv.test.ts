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

test('start upstream proxy test server', async () => {
    upstream = http.createServer((req, res) => {
        if (req.url === '/json' && req.method === 'GET') {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: true, via: 'proxy' }));
            return;
        }

        if (req.url === '/echo' && req.method === 'POST') {
            const chunks: Buffer[] = [];
            req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            req.on('end', () => {
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({
                    authorization: req.headers.authorization,
                    cookie: req.headers.cookie || null,
                    body: Buffer.concat(chunks).toString('utf-8')
                }));
            });
            return;
        }

        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not Found' }));
    });

    await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', () => resolve()));

    const address = upstream.address();
    if (!address || typeof address === 'string') throw new Error('Could not determine upstream address');
    upstreamOrigin = `http://127.0.0.1:${address.port}`;
});

test('PUT api/config proxy whitelist', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'proxy::enabled': true,
                'proxy::whitelist': [upstreamOrigin]
            }
        }, false);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            'proxy::enabled': true,
            'proxy::whitelist': [upstreamOrigin]
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
                bearer: flight.token.admin
            },
            body: {
                'proxy::enabled': false,
                'proxy::whitelist': [upstreamOrigin]
            }
        }, false);

        assert.equal(disable.status, 200);

        const res = await flight.fetch('/api/proxy', {
            method: 'POST',
            auth: {
                bearer: flight.token.user
            },
            body: {
                url: `${upstreamOrigin}/json`,
                method: 'GET'
            }
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Proxy is disabled');

        const enable = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'proxy::enabled': true,
                'proxy::whitelist': [upstreamOrigin]
            }
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
                bearer: flight.token.user
            },
            body: {
                url: `${upstreamOrigin}/json`,
                method: 'GET'
            }
        }, false);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 200);
        assert.equal(res.body.headers['content-type'], 'application/json');
        assert.deepEqual(res.body.body, {
            ok: true,
            via: 'proxy'
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
                bearer: flight.token.user
            },
            body: {
                url: `${upstreamOrigin}/echo`,
                method: 'POST',
                headers: {
                    authorization: 'Bearer upstream-token',
                    'content-type': 'application/json'
                },
                body: {
                    ok: true
                }
            }
        }, false);

        assert.equal(res.status, 200);
        assert.equal(res.body.status, 200);
        assert.deepEqual(res.body.body, {
            authorization: 'Bearer upstream-token',
            cookie: null,
            body: '{"ok":true}'
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
                bearer: flight.token.user
            },
            body: {
                url: 'https://example.com/test',
                method: 'GET'
            }
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
                bearer: flight.token.user
            },
            body: {
                url: `${upstreamOrigin}/json`,
                method: 'GET',
                headers: {
                    cookie: 'nope'
                }
            }
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Header cookie is not allowed');
    } catch (err) {
        assert.ifError(err);
    }
});

test('stop upstream proxy test server', async () => {
    await new Promise<void>((resolve, reject) => upstream.close((err) => err ? reject(err) : resolve()));
});

flight.landing();