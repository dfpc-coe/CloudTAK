process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });
flight.integration('test-task');
flight.connection();

const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');

async function raw(path: string, init: RequestInit = {}) {
    const res = await fetch(new URL(path, flight.base), init);
    return { status: res.status, body: await res.json(), challenge: res.headers.get('www-authenticate') };
}

test('Security: create layer', async () => {
    await flight.config!.models.Layer.generate({
        name: 'Unscoped Layer',
        task: 1,
        version: '1.0.0',
        connection: 1,
        permissions: [],
    });
});

test('Security: an unauthenticated request is rejected before its body is parsed', async () => {
    const res = await raw('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: '{"malformed": ',
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'No Auth Present');
    assert.equal(res.challenge, 'Bearer');
});

test('Security: an unauthenticated request is rejected before it is validated', async () => {
    const res = await raw('/api/connection/not-a-number');

    assert.equal(res.status, 401);
});

test('Security: a malformed body from an authenticated caller is a JSON 400', async () => {
    const res = await raw('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${flight.token.admin}` },
        body: '{"malformed": ',
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.status, 400);
});

test('Security: routes without a declaration accept users only', async () => {
    const res = await raw('/api/profile', {
        headers: { authorization: `Bearer ${layerToken}` },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'Resource token cannot access this resource');
});

test('Security: a query token is only accepted where the route declares it', async () => {
    const denied = await raw(`/api/profile?token=${flight.token.admin}`);
    assert.equal(denied.status, 401);

    const allowed = await raw(`/api/profile/feature?token=${flight.token.admin}`);
    assert.equal(allowed.status, 200);
});

test('Security: an admin route rejects other users', async () => {
    const denied = await raw('/api/user', {
        headers: { authorization: `Bearer ${flight.token.user}` },
    });

    assert.equal(denied.status, 401);
    assert.equal(denied.body.message, 'User must be a System Administrator to access this resource');

    const allowed = await raw('/api/user', {
        headers: { authorization: `Bearer ${flight.token.admin}` },
    });

    assert.equal(allowed.status, 200);
});

test('Security: a token missing a scope is told which one', async () => {
    const res = await raw('/api/core/event', {
        headers: { authorization: `Bearer ${layerToken}` },
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'Layer token does not have the event:read permission');
});

test('Security: a resource only route rejects users', async () => {
    const res = await raw('/api/layer/1/cot', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${flight.token.admin}` },
        body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
    });

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Only a resource token can access this resource');
});

test('Security: a token bound to another id is rejected by the route', async () => {
    const res = await raw('/api/layer/2/cot', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${layerToken}` },
        body: JSON.stringify({ type: 'FeatureCollection', features: [] }),
    });

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'Resource token cannot access this resource');
});

test('Security: a connection token cannot change the agency of its connection', async () => {
    const token = await flight.fetch('/api/connection/1/token', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: { name: 'Agency Token', permissions: [] },
    }, true);

    const denied = await raw('/api/connection/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token.body.token}` },
        body: JSON.stringify({ agency: 2 }),
    });

    assert.equal(denied.status, 401);
    assert.equal(denied.body.message, 'Only an authenticated user can access this resource');

    const connection = await flight.config!.models.Connection.from(1);
    assert.equal(connection.agency, null);

    const allowed = await raw('/api/connection/1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token.body.token}` },
        body: JSON.stringify({ description: 'Updated by a Connection token' }),
    });

    assert.equal(allowed.status, 200);
});

test('Security: public routes need no credentials', async () => {
    const res = await raw('/api/config/login');

    assert.equal(res.status, 200);
});

test('Security: public config keys need no credentials', async () => {
    const res = await raw('/api/config?keys=login::name,login::logo');

    assert.equal(res.status, 200);
    assert.equal(res.body['login::name'], 'CloudTAK');
});

test('Security: non-public config keys still need credentials', async () => {
    const user = await raw('/api/config?keys=login::name,map::center');
    assert.equal(user.status, 401);

    const admin = await raw('/api/config?keys=geofence::password', {
        headers: { authorization: `Bearer ${flight.token.user}` },
    });
    assert.equal(admin.status, 401);
});

flight.landing();
