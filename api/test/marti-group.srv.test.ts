import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

const groups = [{
    name: 'MESA - FIRE',
    direction: 'OUT',
    created: '2025-06-26T16:51:41.028Z',
    type: 'SYSTEM',
    bitpos: 187,
    active: true,
    description: 'Description',
}];

function mockGroups(status = 200) {
    flight.tak.mockMarti.unshift(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) {
            return false;
        } else if (request.method === 'GET' && request.url === '/Marti/api/groups/all?useCache=true') {
            response.setHeader('Content-Type', 'application/json');
            response.statusCode = status;

            if (status === 200) {
                response.write(JSON.stringify({
                    version: 3,
                    type: 'com.bbn.marti.remote.groups.Group',
                    data: groups,
                }));
            } else {
                response.write('Internal Server Error');
            }

            response.end();

            return true;
        } else {
            return false;
        }
    });
}

test('GET: api/marti/group?connection=1 - Connection Certificate', async () => {
    try {
        mockGroups();

        const res = await flight.fetch('/api/marti/group?connection=1&useCache=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            version: '3',
            type: 'com.bbn.marti.remote.groups.Group',
            data: groups,
        });
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/group?connection=0 - Server Certificate', async () => {
    try {
        mockGroups();

        const res = await flight.fetch('/api/marti/group?connection=0&useCache=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.data, groups);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/group - Connection Token infers the Connection', async () => {
    try {
        mockGroups();

        const connectionToken = 'etl.' + jwt.sign({ access: 'connection', id: 1, internal: true }, 'coe-wildland-fire');

        const res = await flight.fetch('/api/marti/group?useCache=true', {
            method: 'GET',
            auth: { bearer: connectionToken },
        }, true);

        assert.deepEqual(res.body.data, groups);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/group - Connection Token rejects a mismatched connection param', async () => {
    try {
        mockGroups();

        const connectionToken = 'etl.' + jwt.sign({ access: 'connection', id: 1, internal: true }, 'coe-wildland-fire');

        const res = await flight.fetch('/api/marti/group?connection=2&useCache=true', {
            method: 'GET',
            auth: { bearer: connectionToken },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Token is scoped to Connection 1');
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/group - Layer Token infers the Connection', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Group Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
            permissions: ['group:read'],
        });

        mockGroups();

        const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');

        const res = await flight.fetch('/api/marti/group?useCache=true', {
            method: 'GET',
            auth: { bearer: layerToken },
        }, true);

        assert.deepEqual(res.body.data, groups);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/group - Layer Token without group:read is rejected', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Unscoped Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
            permissions: [],
        });

        const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 2, internal: true }, 'coe-wildland-fire');

        const res = await flight.fetch('/api/marti/group?useCache=true', {
            method: 'GET',
            auth: { bearer: layerToken },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the group:read permission');
    } catch (err) {
        assert.ifError(err);
    }
});

test('Connection Token: group:read can list but not update groups', async () => {
    try {
        const created = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Group Reader',
                permissions: ['group:read'],
            },
        }, true);

        mockGroups();

        const list = await flight.fetch('/api/marti/group?useCache=true', {
            method: 'GET',
            auth: { bearer: created.body.token },
        }, true);

        assert.deepEqual(list.body.data, groups);

        const update = await flight.fetch('/api/marti/group', {
            method: 'PUT',
            auth: { bearer: created.body.token },
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groups),
        }, false);

        assert.equal(update.status, 403);
        assert.equal(update.body.message, 'Connection token does not have the group:update permission');
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('Connection Token: no group permission cannot list groups', async () => {
    try {
        // Connection tokens are a JWT of { id, access, iat } - two tokens minted for
        // the same Connection within one second collide on the primary key
        await new Promise(resolve => setTimeout(resolve, 1100));

        const created = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'No Groups',
                permissions: ['device:read'],
            },
        }, true);

        const res = await flight.fetch('/api/marti/group?useCache=true', {
            method: 'GET',
            auth: { bearer: created.body.token },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Connection token does not have the group:read permission');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/marti/group?connection=1 - TAK Server Failure', async () => {
    try {
        mockGroups(500);

        const res = await flight.fetch('/api/marti/group?connection=1&useCache=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 500);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.landing();
