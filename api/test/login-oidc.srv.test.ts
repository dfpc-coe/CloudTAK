import test from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.server('admin@example.com', 'password123');

let idpUrl = '';
let userinfoEmail = 'Admin@Example.com';

const idp = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'GET' && req.url === '/.well-known/openid-configuration') {
        res.end(JSON.stringify({
            authorization_endpoint: `${idpUrl}/authorize`,
            token_endpoint: `${idpUrl}/token`,
            userinfo_endpoint: `${idpUrl}/userinfo`,
        }));
    } else if (req.method === 'POST' && req.url === '/token') {
        res.end(JSON.stringify({
            access_token: 'idp-access-token',
            token_type: 'Bearer',
        }));
    } else if (req.method === 'GET' && req.url === '/userinfo') {
        if (req.headers.authorization !== 'Bearer idp-access-token') {
            res.statusCode = 401;
            res.end(JSON.stringify({ error: 'invalid_token' }));
        } else {
            res.end(JSON.stringify({ sub: 'test-subject', email: userinfoEmail }));
        }
    } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: 'not_found' }));
    }
});

test('start: mock OIDC IdP', async () => {
    await new Promise<void>(resolve => idp.listen(0, '127.0.0.1', resolve));
    idpUrl = `http://127.0.0.1:${(idp.address() as AddressInfo).port}`;
});

/**
 * Complete the browser side of the SSO flow: obtain the IdP redirect,
 * then hit the callback with the state and a fake code, returning the
 * callback's redirect location
 */
async function ssoLogin(): Promise<URL> {
    const start = await fetch(`${flight.base}/api/login/oidc`, { redirect: 'manual' });
    assert.equal(start.status, 302);

    const idpLocation = new URL(String(start.headers.get('location')));
    const state = idpLocation.searchParams.get('state');
    assert.ok(state);

    const cb = await fetch(
        `${flight.base}/api/login/oidc/callback?code=test-code&state=${encodeURIComponent(String(state))}`,
        { redirect: 'manual' },
    );
    assert.equal(cb.status, 302);

    return new URL(String(cb.headers.get('location')), flight.base);
}

function ssoPayload(location: URL): {
    access: string;
    email: string;
    session: string;
    token: string;
    redirect?: string;
} {
    assert.ok(location.hash.startsWith('#sso='), `Expected #sso= fragment, got: ${location}`);
    return JSON.parse(Buffer.from(location.hash.slice('#sso='.length), 'base64url').toString());
}

test('PUT: api/config - enable OIDC enforcement', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'oidc::enabled': true,
                'oidc::enforced': true,
            },
        }, false);

        assert.equal(res.status, 200);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login - rejected when OIDC enforced', async () => {
    try {
        const res = await flight.fetch('/api/login', {
            method: 'POST',
            body: {
                username: 'admin@example.com',
                password: 'password123',
            },
        }, false);

        assert.equal(res.status, 403);
        assert.deepEqual(res.body, {
            status: 403,
            message: 'Username/Password login is disabled - Please use SSO',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/config - disable OIDC enforcement, keep enabled', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'oidc::enabled': true,
                'oidc::enforced': false,
            },
        }, false);

        assert.equal(res.status, 200);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login - allowed when OIDC enabled but not enforced', async () => {
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

test('PUT: api/config - configure OIDC provider', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'oidc::enabled': true,
                'oidc::discovery': `${idpUrl}/.well-known/openid-configuration`,
                'oidc::client': 'cloudtak-test',
                'oidc::secret': 'cloudtak-test-secret',
            },
        }, false);

        assert.equal(res.status, 200);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/login/oidc - redirects to the IdP', async () => {
    try {
        const res = await fetch(`${flight.base}/api/login/oidc`, { redirect: 'manual' });

        assert.equal(res.status, 302);

        const location = new URL(String(res.headers.get('location')));
        assert.equal(`${location.origin}${location.pathname}`, `${idpUrl}/authorize`);
        assert.equal(location.searchParams.get('response_type'), 'code');
        assert.equal(location.searchParams.get('client_id'), 'cloudtak-test');
        assert.equal(location.searchParams.get('redirect_uri'), `${flight.base}/api/login/oidc/callback`);
        assert.equal(location.searchParams.get('scope'), 'openid profile email');
        assert.ok(location.searchParams.get('state'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/login/oidc/callback - existing user logs in and reuses certificate', async () => {
    try {
        const before = await flight.config!.models.Profile.from('admin@example.com');

        const payload = ssoPayload(await ssoLogin());

        assert.equal(payload.email, 'admin@example.com');
        assert.equal(payload.access, 'admin');
        assert.ok(payload.token);
        assert.ok(payload.session);

        const login = await flight.fetch('/api/login', {
            method: 'GET',
            auth: {
                bearer: payload.token,
            },
        }, false);

        assert.equal(login.status, 200);
        assert.deepEqual(login.body, {
            email: 'admin@example.com',
            access: 'admin',
        });

        const after = await flight.config!.models.Profile.from('admin@example.com');
        assert.equal(after.auth.cert, before.auth.cert, 'Existing valid certificate must be reused');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/login/oidc/callback - new user is enrolled via Bearer token', async () => {
    try {
        userinfoEmail = 'New.User@Example.com';

        const payload = ssoPayload(await ssoLogin());

        assert.equal(payload.email, 'new.user@example.com');
        assert.equal(payload.access, 'user');

        const profile = await flight.config!.models.Profile.from('new.user@example.com');
        assert.ok(profile.auth.cert.includes('BEGIN CERTIFICATE'), 'Profile must have an enrolled certificate');
        assert.ok(profile.auth.key.includes('PRIVATE KEY'), 'Profile must have an enrolled key');
    } catch (err) {
        assert.ifError(err);
    } finally {
        userinfoEmail = 'Admin@Example.com';
    }
});

test('GET: api/login/oidc/callback - invalid state is rejected', async () => {
    try {
        const res = await fetch(
            `${flight.base}/api/login/oidc/callback?code=test-code&state=garbage`,
            { redirect: 'manual' },
        );

        assert.equal(res.status, 302);

        const location = new URL(String(res.headers.get('location')), flight.base);
        assert.equal(location.pathname, '/login');
        assert.ok(location.searchParams.get('sso_error'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/login/oidc - disabled returns error redirect', async () => {
    try {
        const disable = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                'oidc::enabled': false,
            },
        }, false);
        assert.equal(disable.status, 200);

        const res = await fetch(`${flight.base}/api/login/oidc`, { redirect: 'manual' });

        assert.equal(res.status, 302);

        const location = new URL(String(res.headers.get('location')), flight.base);
        assert.equal(location.pathname, '/login');
        assert.ok(String(location.searchParams.get('sso_error')).includes('not enabled'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('stop: mock OIDC IdP', async () => {
    await new Promise<void>((resolve, reject) => idp.close(err => err ? reject(err) : resolve()));
});

flight.landing();
