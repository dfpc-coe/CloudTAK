import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.server('admin@example.com', 'password123');

let session: string;
let token: string;

test('GET: api/user/admin@example.com/session - empty before login', async () => {
    try {
        const res = await flight.fetch('/api/user/admin@example.com/session', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login - create session', async () => {
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
        token = res.body.token;
        delete res.body.token;
        assert.ok(res.body.session);
        session = res.body.session;
        delete res.body.session;

        assert.deepEqual(res.body, {
            access: 'admin',
            email: 'admin@example.com',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/user/admin@example.com/session - populated after login', async () => {
    try {
        const res = await flight.fetch('/api/user/admin@example.com/session', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);

        const session = res.body.items[0];
        assert.equal(session.username, 'admin@example.com');
        assert.ok(session.id);
        assert.ok(session.created);
        assert.ok(session.ip);
        assert.ok(session.device_type);
        assert.ok(session.browser);
        assert.ok(session.os);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/login - Session token authenticates while the session lives', async () => {
    try {
        const res = await flight.fetch('/api/login', {
            method: 'GET',
            auth: {
                bearer: token,
            },
        }, false);

        assert.deepEqual(res.body, {
            email: 'admin@example.com',
            access: 'admin',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/login - Terminating the session invalidates its token', async () => {
    try {
        await flight.config!.models.ProfileSession.delete(session);

        const res = await flight.fetch('/api/login', {
            method: 'GET',
            auth: {
                bearer: token,
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Session does not exist',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
