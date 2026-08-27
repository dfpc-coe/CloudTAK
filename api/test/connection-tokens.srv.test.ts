import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString();
let token: string;

test('GET: api/connection/1/token', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/token', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/token', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Test Token',
            },
        }, true);

        assert.ok(res.body.created, 'has created');
        res.body.created = time;

        assert.ok(res.body.created, 'has updated');
        res.body.updated = time;

        assert.ok(res.body.token, 'has token');
        assert.ok(res.body.token.startsWith('etl.ey'), 'valid token');

        token = res.body.token;
        res.body.token = 'etl.123';

        assert.deepEqual(res.body, {
            id: 1,
            connection: 1,
            name: 'Test Token',
            username: 'admin@example.com',
            permissions: [],
            token: 'etl.123',
            created: time,
            updated: time,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/token - with permissions', async () => {
    try {
        // Connection JWTs carry no unique claim so two minted in the same second collide
        await new Promise(resolve => setTimeout(resolve, 1100));

        const res = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Scoped Token',
                permissions: ['device:read', 'video:*'],
            },
        }, true);

        assert.deepEqual(res.body.permissions, ['device:read', 'video:*']);
        assert.equal(res.body.username, 'admin@example.com');

        const list = await flight.fetch('/api/connection/1/token', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(list.body.items.map((t: { permissions: Array<string> }) => t.permissions), [[], ['device:read', 'video:*']]);

        const patch = await flight.fetch('/api/connection/1/token/2', {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { permissions: ['device:read'] },
        }, true);

        assert.equal(patch.body.status, 200);

        const denied = await flight.fetch('/api/connection/1/video/lease', {
            method: 'POST',
            auth: { bearer: res.body.token },
            body: { name: 'Denied Lease' },
        }, false);

        assert.equal(denied.status, 403);
        assert.equal(denied.body.message, 'Connection token does not have the video:create permission');

        const allowed = await flight.fetch('/api/core/device', {
            method: 'GET',
            auth: { bearer: res.body.token },
        }, true);

        assert.equal(allowed.body.total, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/token - invalid permission', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Bad Token',
                permissions: ['device:fly'],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(res.body.message.startsWith('Unknown Permission: device:fly'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1 - Use Token', async () => {
    try {
        const res = await flight.fetch('/api/connection/1', {
            method: 'GET',
            auth: {
                bearer: token,
            },
        }, true);

        assert.ok(res.body.created, 'has created');
        res.body.created = time;

        assert.ok(res.body.created, 'has updated');
        res.body.updated = time;

        assert.ok(res.body.certificate.validFrom, 'has certificate.validFrom');
        res.body.certificate.validFrom = time;

        assert.ok(res.body.certificate.validTo, 'has certificate.validTo');
        res.body.certificate.validTo = time;

        assert.deepEqual(res.body, {
            status: 'dead',
            certificate: {
                validFrom: time,
                validTo: time,
                subject: 'CN=Alice',
            },
            id: 1,
            readonly: false,
            agency: null,
            created: time,
            updated: time,
            username: 'admin@example.com',
            name: 'Test Connection',
            description: 'Connection created by Flight Test Runner',
            enabled: true,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/token/1', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/token/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'New Token Name',
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Connection Token Updated',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/connection/1/token/1', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/token/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Connection Token Deleted',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1 - Use Token, Access Revoked', async () => {
    try {
        const res = await flight.fetch('/api/connection/1', {
            method: 'GET',
            auth: {
                bearer: token,
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 403,
            message: 'Token does not exist',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
