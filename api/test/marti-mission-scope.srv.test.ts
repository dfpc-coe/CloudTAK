process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.integration('test-task');
flight.connection();

const GUID = '9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71';

const MISSION = {
    name: 'Scoped Mission',
    guid: GUID,
    createTime: '2024-01-01T00:00:00Z',
    description: 'test description',
    tool: 'public',
    keywords: [],
    externalData: [],
    feeds: [],
    mapLayers: [],
    inviteOnly: false,
    expiration: 3600,
    uids: [],
    contents: [],
    passwordProtected: false,
    role: { role: 'OWNER', permissions: [] },
    groups: ['channel-1'],
};

type Call = { method: string; url: URL; auth?: string };

function mockMissions(calls: Array<Call>) {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');
        if (!url.pathname.startsWith('/Marti/api/missions')) return false;

        calls.push({
            method: request.method,
            url,
            auth: request.headers['missionauthorization'] as string | undefined,
        });

        response.setHeader('Content-Type', 'application/json');
        response.write(JSON.stringify({
            version: '3',
            type: 'Mission',
            data: /invite|changes/.test(url.pathname) ? [] : [MISSION],
            nodeId: 'test',
        }));
        response.end();
        return true;
    });
}

function layerToken(id: number): string {
    return 'etl.' + jwt.sign({ access: 'layer', id, internal: true }, 'coe-wildland-fire');
}

test('Mission Scopes - create layers', async () => {
    await flight.config!.models.Layer.generate({
        name: 'Mission Layer',
        task: 1,
        version: '1.0.0',
        connection: 1,
        permissions: ['mission:*'],
    });

    await flight.config!.models.Layer.generate({
        name: 'Read Only Layer',
        task: 1,
        version: '1.0.0',
        connection: 1,
        permissions: ['mission:read'],
    });

    await flight.config!.models.Layer.generate({
        name: 'Unscoped Layer',
        task: 1,
        version: '1.0.0',
        connection: 1,
        permissions: ['event:read'],
    });
});

test('GET: api/marti/mission - layer token without mission:read', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        const res = await flight.fetch('/api/marti/mission', {
            method: 'GET',
            auth: { bearer: layerToken(3) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission:read permission');
        assert.equal(calls.length, 0);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/mission - layer token with mission:read', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        const res = await flight.fetch('/api/marti/mission', {
            method: 'GET',
            auth: { bearer: layerToken(2) },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].guid, GUID);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('POST: api/marti/mission - layer token without mission:create', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        const res = await flight.fetch('/api/marti/mission', {
            method: 'POST',
            auth: { bearer: layerToken(2) },
            body: { name: 'Scoped Mission', group: ['channel-1'] },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(calls.length, 0);
    } finally {
        flight.tak.reset();
    }
});

test('POST: api/marti/mission - layer token creates as its connection layer', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        const res = await flight.fetch('/api/marti/mission', {
            method: 'POST',
            auth: { bearer: layerToken(1) },
            body: { name: 'Scoped Mission', group: ['channel-1'] },
        }, true);

        assert.equal(res.body.guid, GUID);

        const create = calls.find(c => c.method === 'POST');
        assert.ok(create);
        assert.equal(create.url.searchParams.get('creatorUid'), 'connection-1-layer-1');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid - layer token uses the MissionAuthorization header', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        await flight.fetch(`/api/marti/missions/${GUID}`, {
            method: 'GET',
            auth: { bearer: layerToken(2) },
            headers: { missionauthorization: 'header-token' },
        }, true);

        assert.equal(calls[0].auth, 'Bearer header-token');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid - layer token uses the token of a Data Sync of its connection', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        await flight.config!.models.Data.generate({
            name: 'Scoped Mission',
            mission_guid: GUID,
            mission_token: 'data-sync-token',
            mission_sync: true,
            connection: 1,
        });

        await flight.fetch(`/api/marti/missions/${GUID}`, {
            method: 'GET',
            auth: { bearer: layerToken(2) },
        }, true);

        assert.equal(calls[0].auth, 'Bearer data-sync-token');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PATCH: api/marti/missions/:guid - layer token without mission:update', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}`, {
            method: 'PATCH',
            auth: { bearer: layerToken(2) },
            body: { description: 'Updated' },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(calls.length, 0);
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid - layer token with mission:delete', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        await flight.fetch(`/api/marti/missions/${GUID}`, {
            method: 'DELETE',
            auth: { bearer: layerToken(1) },
        }, true);

        const del = calls.find(c => c.method === 'DELETE');
        assert.ok(del);
        assert.equal(del.auth, 'Bearer data-sync-token');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('Mission Scopes - create sub-resource layers', async () => {
    await flight.config!.models.Layer.generate({
        name: 'Feature Layer',
        task: 1,
        version: '1.0.0',
        connection: 1,
        permissions: ['mission:read', 'mission-feature:read', 'mission-log:create', 'mission-layer:*'],
    });

    await flight.config!.models.Layer.generate({
        name: 'Feature Layer without mission:read',
        task: 1,
        version: '1.0.0',
        connection: 1,
        permissions: ['mission-feature:*'],
    });
});

test('GET: api/marti/missions/:guid/cot - mission:* does not cover mission-feature', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/cot`, {
            method: 'GET',
            auth: { bearer: layerToken(1) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission-feature:read permission');
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid/cot - mission-feature requires mission:read', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/cot`, {
            method: 'GET',
            auth: { bearer: layerToken(5) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission:read permission');
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid/cot - layer token with mission-feature:read', async () => {
    const calls: Array<Call> = [];

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');
        if (!url.pathname.endsWith('/cot')) return false;

        calls.push({
            method: request.method,
            url,
            auth: request.headers['missionauthorization'] as string | undefined,
        });

        response.setHeader('Content-Type', 'application/xml');
        response.write('<?xml version="1.0" encoding="UTF-8"?><events></events>');
        response.end();
        return true;
    });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/cot`, {
            method: 'GET',
            auth: { bearer: layerToken(4) },
        }, true);

        assert.deepEqual(res.body.features, []);
        assert.equal(calls[0].auth, 'Bearer data-sync-token');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/cot - layer token without mission-feature:create', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/cot`, {
            method: 'PUT',
            auth: { bearer: layerToken(4) },
            body: {
                features: [{
                    id: 'feature-1',
                    type: 'Feature',
                    properties: { type: 'a-f-G', callsign: 'Feature' },
                    geometry: { type: 'Point', coordinates: [-105, 40] },
                }],
            },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission-feature:create permission');
    } finally {
        flight.tak.reset();
    }
});

test('POST: api/marti/missions/:guid/log - layer token creates as its connection layer', async () => {
    const calls: Array<Call> = [];
    let body = '';

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');
        if (request.method !== 'POST' || !url.pathname.includes('/log')) return false;

        for await (const chunk of request) body += String(chunk);

        calls.push({
            method: request.method,
            url,
            auth: request.headers['missionauthorization'] as string | undefined,
        });

        response.setHeader('Content-Type', 'application/json');
        response.write(JSON.stringify({ version: '3', type: 'MissionLog', data: {}, nodeId: 'test' }));
        response.end();
        return true;
    });
    mockMissions([]);

    try {
        await flight.fetch(`/api/marti/missions/${GUID}/log`, {
            method: 'POST',
            auth: { bearer: layerToken(4) },
            body: { content: 'Layer authored log' },
        }, true);

        assert.equal(calls.length, 1);
        assert.equal(calls[0].auth, 'Bearer data-sync-token');
        assert.equal(JSON.parse(body).creatorUid, 'connection-1-layer-4');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid/log/:log - layer token without mission-log:delete', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/log/log-1`, {
            method: 'DELETE',
            auth: { bearer: layerToken(4) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission-log:delete permission');
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid/upload/:hash - layer token without mission-file:delete', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/upload/abc123`, {
            method: 'DELETE',
            auth: { bearer: layerToken(4) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission-file:delete permission');
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid/layer - layer token with mission-layer:*', async () => {
    const calls: Array<Call> = [];

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');
        if (!url.pathname.endsWith('/layers')) return false;

        calls.push({
            method: request.method,
            url,
            auth: request.headers['missionauthorization'] as string | undefined,
        });

        response.setHeader('Content-Type', 'application/json');
        response.write(JSON.stringify({ version: '3', type: 'MissionLayer', data: [], nodeId: 'test' }));
        response.end();
        return true;
    });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/layer`, {
            method: 'GET',
            auth: { bearer: layerToken(4) },
        }, true);

        assert.deepEqual(res.body.data, []);
        assert.equal(calls[0].auth, 'Bearer data-sync-token');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/upload - layer tokens cannot attach profile files', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/upload`, {
            method: 'PUT',
            auth: { bearer: layerToken(1) },
            body: { assets: [] },
        }, false);

        assert.equal(res.status, 403);
    } finally {
        flight.tak.reset();
    }
});

test('Mission Scopes - create user layer', async () => {
    await flight.config!.models.Layer.generate({
        name: 'User Layer',
        task: 1,
        version: '1.0.0',
        connection: 1,
        permissions: ['mission:read', 'mission-user:read', 'mission-user:create'],
    });
});

test('GET: api/marti/missions/:guid/changes - layer token with mission:read', async () => {
    const calls: Array<Call> = [];
    mockMissions(calls);

    try {
        await flight.fetch(`/api/marti/missions/${GUID}/changes`, {
            method: 'GET',
            auth: { bearer: layerToken(2) },
        }, true);

        assert.ok(calls[0].url.pathname.endsWith('/changes'));
        assert.equal(calls[0].auth, 'Bearer data-sync-token');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid/qr - layer token with mission:read', async () => {
    mockMissions([]);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/qr`, {
            method: 'GET',
            auth: { bearer: layerToken(2) },
        }, { verify: false, json: false });

        assert.equal(res.status, 200);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid/archive - layer token without mission:read', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/archive`, {
            method: 'GET',
            auth: { bearer: layerToken(3) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission:read permission');
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/property - layer token without mission:update', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/property`, {
            method: 'PUT',
            auth: { bearer: layerToken(2) },
            body: { key: 'caltopo', value: 'ABC123' },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission:update permission');
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/property - layer token sets as its connection layer', async () => {
    const calls: Array<Call> = [];
    let body = '';

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');
        if (!url.pathname.includes('/propert')) return false;

        for await (const chunk of request) body += String(chunk);

        calls.push({
            method: request.method,
            url,
            auth: request.headers['missionauthorization'] as string | undefined,
        });

        response.setHeader('Content-Type', 'application/json');
        response.write(JSON.stringify({
            version: '3',
            type: 'MissionProperty',
            data: { key: 'caltopo', value: 'ABC123' },
            nodeId: 'test',
        }));
        response.end();
        return true;
    });
    mockMissions([]);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/property`, {
            method: 'PUT',
            auth: { bearer: layerToken(1) },
            body: { key: 'caltopo', value: 'ABC123' },
        }, true);

        assert.equal(res.body.data.key, 'caltopo');
        assert.equal(calls.length, 1);
        assert.equal(calls[0].auth, 'Bearer data-sync-token');
        assert.ok((calls[0].url.search + body).includes('connection-1-layer-1'));
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid/subscriptions/roles - mission:* does not cover mission-user', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/subscriptions/roles`, {
            method: 'GET',
            auth: { bearer: layerToken(1) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission-user:read permission');
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid/subscriptions/roles - layer token with mission-user:read', async () => {
    const calls: Array<Call> = [];

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');
        if (!url.pathname.endsWith('/subscriptions/roles')) return false;

        calls.push({
            method: request.method,
            url,
            auth: request.headers['missionauthorization'] as string | undefined,
        });

        response.setHeader('Content-Type', 'application/json');
        response.write(JSON.stringify({ version: '3', type: 'MissionSubscription', data: [], nodeId: 'test' }));
        response.end();
        return true;
    });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/subscriptions/roles`, {
            method: 'GET',
            auth: { bearer: layerToken(6) },
        }, true);

        assert.deepEqual(res.body.data, []);
        assert.equal(calls[0].auth, 'Bearer data-sync-token');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('POST: api/marti/missions/:guid/invite - layer token invites as its connection layer', async () => {
    const calls: Array<Call> = [];

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');
        if (!url.pathname.includes('/invite')) return false;

        calls.push({
            method: request.method,
            url,
            auth: request.headers['missionauthorization'] as string | undefined,
        });

        response.statusCode = 200;
        response.end();
        return true;
    });
    mockMissions([]);

    try {
        await flight.fetch(`/api/marti/missions/${GUID}/invite`, {
            method: 'POST',
            auth: { bearer: layerToken(6) },
            body: { type: 'userName', invitee: 'user@example.com', role: 'MISSION_SUBSCRIBER' },
        }, true);

        assert.equal(calls.length, 1);
        assert.equal(calls[0].url.searchParams.get('creatorUid'), 'connection-1-layer-6');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/role - layer token without mission-user:update', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/role`, {
            method: 'PUT',
            auth: { bearer: layerToken(6) },
            body: { clientUid: 'uid', username: 'user@example.com', role: 'MISSION_SUBSCRIBER' },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission-user:update permission');
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid/user - layer token without mission-user:delete', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/user?uid=some-uid`, {
            method: 'DELETE',
            auth: { bearer: layerToken(6) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission-user:delete permission');
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid/invite - layer token without mission-user:delete', async () => {
    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/invite?type=userName&invitee=user@example.com`, {
            method: 'DELETE',
            auth: { bearer: layerToken(6) },
        }, false);

        assert.equal(res.status, 403);
        assert.equal(res.body.message, 'Layer token does not have the mission-user:delete permission');
    } finally {
        flight.tak.reset();
    }
});

flight.landing();
