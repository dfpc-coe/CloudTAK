import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import ws from 'ws';
import { sql } from 'drizzle-orm';
import { ProfileSession } from '../common/schema.js';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });
flight.server('admin@example.com', 'password123');

let session: string;
let token: string;
let refresh: string;
let previousRefresh: string;

function lifetime(token: string): number {
    const decoded = jwt.decode(token) as { iat: number; exp: number };
    return decoded.exp - decoded.iat;
}

test('POST: api/login - default token lifetime is 8 days', async () => {
    try {
        const res = await flight.fetch('/api/login', {
            method: 'POST',
            body: { username: 'user@example.com', password: 'password123' },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(lifetime(res.body.token), 192 * 3600);
        assert.equal(typeof res.body.refresh, 'string');
        assert.ok(res.body.refresh.length >= 43);

        session = res.body.session;
        token = res.body.token;
        refresh = res.body.refresh;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/user/user@example.com/session - refresh secrets are not listed', async () => {
    try {
        const res = await flight.fetch('/api/user/user@example.com/session', {
            method: 'GET',
            auth: { bearer: token },
        }, true);

        assert.equal(res.body.total, 1);
        assert.deepEqual(Object.keys(res.body.items[0]).sort(), [
            'active', 'browser', 'created', 'device_type', 'id', 'ip', 'os', 'user_agent', 'username',
        ]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/refresh - rotates the token pair', async () => {
    try {
        const res = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.session, session);
        assert.equal(res.body.email, 'user@example.com');
        assert.equal(res.body.access, 'user');
        assert.notEqual(res.body.refresh, refresh);
        assert.equal(lifetime(res.body.token), 192 * 3600);

        previousRefresh = refresh;
        refresh = res.body.refresh;
        token = res.body.token;

        const login = await flight.fetch('/api/login', {
            method: 'GET',
            auth: { bearer: token },
        }, true);

        assert.equal(login.body.email, 'user@example.com');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/refresh - a just rotated token is rejected without revoking the session', async () => {
    try {
        const res = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh: previousRefresh },
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Invalid refresh token',
            messages: [],
        });

        const login = await flight.fetch('/api/login', {
            method: 'GET',
            auth: { bearer: token },
        }, true);

        assert.equal(login.body.email, 'user@example.com');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/refresh - unknown token', async () => {
    try {
        const res = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh: 'not-a-refresh-token' },
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Invalid refresh token',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/refresh - replay outside the grace window revokes the session', async () => {
    try {
        await flight.config!.models.ProfileSession.commit(session, {
            last_refreshed: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        });

        const res = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh: previousRefresh },
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Refresh token reuse detected - session revoked',
            messages: [],
        });

        const login = await flight.fetch('/api/login', {
            method: 'GET',
            auth: { bearer: token },
        }, false);

        assert.deepEqual(login.body, {
            status: 401,
            message: 'Session does not exist',
            messages: [],
        });

        const current = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh },
        }, false);

        assert.equal(current.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/refresh - refreshing slides the session expiry forward', async () => {
    try {
        const login = await flight.fetch('/api/login', {
            method: 'POST',
            body: { username: 'user@example.com', password: 'password123' },
        }, true);

        // Nearly expired but still valid
        await flight.config!.models.ProfileSession.commit(login.body.session, {
            refresh_expires: new Date(Date.now() + 60 * 1000).toISOString(),
        });

        const res = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh: login.body.refresh },
        }, true);

        assert.equal(res.status, 200);

        const [row] = await flight.config!.pg
            .select({ extended: sql<boolean>`${ProfileSession.refresh_expires} > Now() + interval '719 hours'` })
            .from(ProfileSession)
            .where(sql`${ProfileSession.id} = ${login.body.session}`);

        assert.equal(row.extended, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/refresh - an expired session cannot be refreshed', async () => {
    try {
        const login = await flight.fetch('/api/login', {
            method: 'POST',
            body: { username: 'user@example.com', password: 'password123' },
        }, true);

        session = login.body.session;
        token = login.body.token;
        refresh = login.body.refresh;

        await flight.config!.models.ProfileSession.commit(session, {
            refresh_expires: new Date(Date.now() - 1000).toISOString(),
        });

        const res = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh },
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'Session has expired',
            messages: [],
        });

        const check = await flight.fetch('/api/login', {
            method: 'GET',
            auth: { bearer: token },
        }, false);

        assert.equal(check.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/user/user@example.com/session/:session - non-admin cannot terminate another user\'s session', async () => {
    try {
        const login = await flight.fetch('/api/login', {
            method: 'POST',
            body: { username: 'user@example.com', password: 'password123' },
        }, true);

        session = login.body.session;
        token = login.body.token;
        refresh = login.body.refresh;

        const admin = await flight.fetch('/api/login', {
            method: 'POST',
            body: { username: 'admin@example.com', password: 'password123' },
        }, true);

        const res = await flight.fetch(`/api/user/admin@example.com/session/${admin.body.session}`, {
            method: 'DELETE',
            auth: { bearer: token },
        }, false);

        assert.deepEqual(res.body, {
            status: 403,
            message: 'Only a System Administrator can terminate login sessions for another user',
            messages: [],
        });

        const mismatch = await flight.fetch(`/api/user/user@example.com/session/${admin.body.session}`, {
            method: 'DELETE',
            auth: { bearer: token },
        }, false);

        assert.equal(mismatch.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/user/user@example.com/session/:session - an open WebSocket is told to log out and closed', async () => {
    try {
        const login = await flight.fetch('/api/login', {
            method: 'POST',
            body: { username: 'user@example.com', password: 'password123' },
        }, true);

        const url = new URL(flight.base.replace(/^http/, 'ws'));
        url.searchParams.append('format', 'geojson');
        url.searchParams.append('connection', 'user@example.com');
        url.searchParams.append('token', login.body.token);

        const conn = new ws(url);
        const received: Array<{ type: string }> = [];

        const closed = new Promise<void>((resolve, reject) => {
            conn.on('error', reject);
            conn.on('close', () => resolve());
            conn.on('message', async (data) => {
                const msg = JSON.parse(String(data));
                received.push(msg);

                if (msg.type === 'connected') {
                    try {
                        const res = await flight.fetch(`/api/user/user@example.com/session/${login.body.session}`, {
                            method: 'DELETE',
                            auth: { bearer: login.body.token },
                        }, true);

                        assert.equal(res.status, 200);
                    } catch (err) {
                        reject(err);
                    }
                }
            });
        });

        await closed;

        assert.deepEqual(received, [
            { type: 'connected' },
            { type: 'logout', properties: { message: 'Session revoked' } },
        ]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/user/user@example.com/session/:session - logout revokes login and refresh tokens', async () => {
    try {
        const res = await flight.fetch(`/api/user/user@example.com/session/${session}`, {
            method: 'DELETE',
            auth: { bearer: token },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Session Terminated',
        });

        const check = await flight.fetch('/api/login', {
            method: 'GET',
            auth: { bearer: token },
        }, false);

        assert.equal(check.status, 401);

        const again = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh },
        }, false);

        assert.equal(again.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/login - session token access follows the profile, not the claim', async () => {
    try {
        const login = await flight.fetch('/api/login', {
            method: 'POST',
            body: { username: 'user@example.com', password: 'password123' },
        }, true);

        session = login.body.session;
        token = login.body.token;
        refresh = login.body.refresh;

        assert.equal(login.body.access, 'user');

        const promote = await flight.fetch('/api/user/user@example.com', {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { system_admin: true },
        }, true);

        assert.equal(promote.status, 200);

        const check = await flight.fetch('/api/login', {
            method: 'GET',
            auth: { bearer: token },
        }, true);

        assert.equal(check.body.access, 'admin');

        const refreshed = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh },
        }, true);

        assert.equal(refreshed.body.access, 'admin');
        token = refreshed.body.token;
        refresh = refreshed.body.refresh;

        const demote = await flight.fetch('/api/user/user@example.com', {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { system_admin: false },
        }, true);

        assert.equal(demote.status, 200);

        const users = await flight.fetch('/api/user', {
            method: 'GET',
            auth: { bearer: token },
        }, false);

        assert.equal(users.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/login/refresh - a disabled user cannot refresh', async () => {
    try {
        const disable = await flight.fetch('/api/user/user@example.com', {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { disabled: true },
        }, true);

        assert.equal(disable.status, 200);

        const res = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh },
        }, false);

        assert.equal(res.status, 401);

        await flight.fetch('/api/user/user@example.com', {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { disabled: false },
        }, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/config - token lifetime cannot exceed the refresh lifetime', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: { 'login::token::expiry': 1000 },
        }, false);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'Login token lifetime cannot exceed the refresh token lifetime',
            messages: [],
        });

        const config = await flight.fetch('/api/config?keys=login::token::expiry,login::refresh::expiry', {
            method: 'GET',
            auth: { bearer: flight.token.user },
        }, false);

        assert.equal(config.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/config - configured token lifetime applies to new logins', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                'login::token::expiry': 2,
                'login::refresh::expiry': 48,
            },
        }, true);

        assert.deepEqual(res.body, {
            'login::token::expiry': 2,
            'login::refresh::expiry': 48,
        });

        const login = await flight.fetch('/api/login', {
            method: 'POST',
            body: { username: 'user@example.com', password: 'password123' },
        }, true);

        assert.equal(lifetime(login.body.token), 2 * 3600);

        const refreshed = await flight.fetch('/api/login/refresh', {
            method: 'POST',
            body: { refresh: login.body.refresh },
        }, true);

        assert.equal(lifetime(refreshed.body.token), 2 * 3600);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
