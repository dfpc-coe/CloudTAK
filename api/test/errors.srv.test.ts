import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false });
flight.server('admin@example.com', 'password123');

let sessionToken: string;
let sessionId: string;
let tracedId: number;

test('GET: api/error - requires admin', async () => {
    try {
        const res = await flight.fetch('/api/error', {
            method: 'GET',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/error - empty', async () => {
    try {
        const res = await flight.fetch('/api/error', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { total: 0, items: [] });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/error - create', async () => {
    try {
        const res = await flight.fetch('/api/error', {
            method: 'POST',
            auth: { bearer: flight.token.user },
            body: { message: 'User Error One' },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Error Logged' });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/error - create with trace', async () => {
    try {
        const res = await flight.fetch('/api/error', {
            method: 'POST',
            auth: { bearer: flight.token.user },
            body: { message: 'User Error Two', trace: 'Error: boom\n  at main' },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Error Logged' });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/error - requires authentication', async () => {
    try {
        const res = await flight.fetch('/api/error', {
            method: 'POST',
            body: { message: 'Anonymous Error' },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login - establish session', async () => {
    try {
        const res = await flight.fetch('/api/login', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: { username: 'admin@example.com', password: 'password123' },
        }, false);

        sessionToken = res.body.token;
        sessionId = res.body.session;

        assert.ok(sessionToken);
        assert.ok(sessionId);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/error - associates session from token', async () => {
    try {
        const res = await flight.fetch('/api/error', {
            method: 'POST',
            auth: { bearer: sessionToken },
            body: { message: 'Session Error' },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Error Logged' });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/error - list all', async () => {
    try {
        const res = await flight.fetch('/api/error', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.total, 3);

        const session = res.body.items.find((i: { message: string }) => i.message === 'Session Error');
        assert.equal(session.username, 'admin@example.com');
        assert.equal(session.session_id, sessionId);

        const traced = res.body.items.find((i: { message: string }) => i.message === 'User Error Two');
        assert.equal(traced.username, 'user@example.com');
        assert.equal(traced.trace, 'Error: boom\n  at main');
        assert.equal(traced.session_id, null);

        tracedId = traced.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/error - filter by message', async () => {
    try {
        const res = await flight.fetch('/api/error?filter=Session', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].message, 'Session Error');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/error - filter by username', async () => {
    try {
        const res = await flight.fetch(`/api/error?username=${encodeURIComponent('user@example.com')}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.total, 2);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/error - filter by session', async () => {
    try {
        const res = await flight.fetch(`/api/error?session_id=${sessionId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].message, 'Session Error');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/error/:errorid - requires admin', async () => {
    try {
        const res = await flight.fetch(`/api/error/${tracedId}`, {
            method: 'GET',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/error/:errorid - fetch single', async () => {
    try {
        const res = await flight.fetch(`/api/error/${tracedId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.id, tracedId);
        assert.equal(res.body.username, 'user@example.com');
        assert.equal(res.body.message, 'User Error Two');
        assert.equal(res.body.trace, 'Error: boom\n  at main');
        assert.equal(res.body.session_id, null);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/error/:errorid - not found', async () => {
    try {
        const res = await flight.fetch('/api/error/999999', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/error/:errorid - requires admin', async () => {
    try {
        const res = await flight.fetch(`/api/error/${tracedId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/error/:errorid - delete single', async () => {
    try {
        const res = await flight.fetch(`/api/error/${tracedId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Error Deleted' });

        const list = await flight.fetch('/api/error', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.total, 2);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/error - requires admin', async () => {
    try {
        const res = await flight.fetch('/api/error', {
            method: 'DELETE',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/error - delete by username', async () => {
    try {
        const res = await flight.fetch(`/api/error?username=${encodeURIComponent('user@example.com')}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Errors Deleted' });

        const list = await flight.fetch('/api/error', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].message, 'Session Error');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/error - delete by session', async () => {
    try {
        const res = await flight.fetch(`/api/error?session_id=${sessionId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Errors Deleted' });

        const list = await flight.fetch('/api/error', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(list.body.total, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/error - delete all', async () => {
    try {
        await flight.fetch('/api/error', {
            method: 'POST',
            auth: { bearer: flight.token.user },
            body: { message: 'Residual Error' },
        }, true);

        const res = await flight.fetch('/api/error', {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Errors Deleted' });

        const list = await flight.fetch('/api/error', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(list.body, { total: 0, items: [] });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
