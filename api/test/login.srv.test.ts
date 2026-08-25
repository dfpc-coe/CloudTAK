import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('POST: api/login', async () => {
    try {
        const res = await flight.fetch('/api/login', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                username: 'admin@example.com',
                password: 'password123',
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'Server has not been configured',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.server('admin@example.com', 'password123');

test('POST: api/login', async () => {
    try {
        const res = await flight.fetch('/api/login', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                username: 'admin@example.com',
                password: 'password123',
            },
        }, false);

        assert.ok(res.body.token);
        delete res.body.token;
        assert.ok(res.body.session);
        delete res.body.session;

        assert.deepEqual(res.body, {
            access: 'admin',
            email: 'admin@example.com',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/login - certificate revoked on the TAK Server', async () => {
    const login = await flight.fetch('/api/login', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: { username: 'admin@example.com', password: 'password123' },
    }, true);

    // Certificate.probe() hits /Marti/api/version with the user cert - TAK Server's X509 filter
    // rethrows a RevokedException which Tomcat renders as a 500 error page; the Admin lookup of
    // the same certificate carries the revocation date
    flight.tak.mockMarti.unshift(async (request, response) => {
        if (request.method === 'GET' && request.url === '/Marti/api/version') {
            response.statusCode = 500;
            response.setHeader('Content-Type', 'text/html');
            response.write([
                '<!doctype html><html lang="en"><head><title>HTTP Status 500 – Internal Server Error</title></head><body>',
                '<h1>HTTP Status 500 – Internal Server Error</h1><p><b>Type</b> Exception Report</p>',
                '<p><b>Message</b> Exception performing TAK Server authentication</p>',
                '<p><b>Exception</b></p><pre>org.springframework.security.authentication.BadCredentialsException: Exception performing TAK Server authentication</pre>',
                '<p><b>Root Cause</b></p><pre>com.bbn.marti.remote.exception.RevokedException: Attempt to use revoked certificate : CN=admin@example.com,OU=WILDFIRE,O=CO-TAK</pre>',
                '</body></html>',
            ].join(''));
            response.end();
            return true;
        } else if (request.method === 'GET' && request.url && request.url.startsWith('/Marti/api/certadmin/cert/')) {
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                version: '3',
                type: 'TakCert',
                data: {
                    id: 1,
                    hash: decodeURIComponent(request.url.replace('/Marti/api/certadmin/cert/', '')),
                    revocationDate: '2026-08-24T21:00:00.000Z',
                },
                nodeId: 'mock',
            }));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/login', {
            method: 'GET',
            auth: { bearer: login.body.token },
        }, false);

        assert.equal(res.status, 401);
        assert.deepEqual(res.body, {
            status: 401,
            message: 'Certificate was revoked on 2026-08-24T21:00:00.000Z',
            messages: [],
        });
    } finally {
        flight.tak.mockMarti.shift();
    }

    // Password login regenerates the certificate and the session is usable again
    const res = await flight.fetch('/api/login', {
        method: 'GET',
        auth: { bearer: login.body.token },
    }, true);

    assert.deepEqual(res.body, {
        access: 'admin',
        email: 'admin@example.com',
    });
});

flight.landing();
