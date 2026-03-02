import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.server('admin@example.com', 'password123');

test('PUT: api/config - enable OIDC enforcement', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'oidc::enabled': true,
                'oidc::enforced': true,
            }
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
                password: 'password123'
            }
        }, false);

        assert.equal(res.status, 403);
        assert.deepEqual(res.body, {
            status: 403,
            message: 'Username/Password login is disabled - Please use SSO',
            messages: []
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
                bearer: flight.token.admin
            },
            body: {
                'oidc::enabled': true,
                'oidc::enforced': false,
            }
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
                bearer: flight.token.admin
            },
            body: {
                username: 'admin@example.com',
                password: 'password123'
            }
        }, false);

        assert.ok(res.body.token);
        delete res.body.token;

        assert.deepEqual(res.body, {
            access: 'admin',
            email: 'admin@example.com',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
