process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http'

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/marti/mission - Sorted List (Oldest => Newest)', async () => {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = request.url;

        if (request.method === 'GET' && url.includes('/Marti/api/missions') && !url.includes('invite')) {
             response.setHeader('Content-Type', 'application/json');
             // Return unordered list
             const mockMission = (name: string, createTime: string) => ({
                 name,
                 createTime,
                 uid: name,
                 guid: name,
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
                 groups: ['channel-1']
             });

             const missions = [
                 mockMission('Mission A', '2023-01-01T00:00:00Z'),
                 mockMission('Mission C', '2023-01-03T00:00:00Z'),
                 mockMission('Mission B', '2023-01-02T00:00:00Z')
             ];
             response.write(JSON.stringify({
                 data: missions,
                 count: 3
             }));
             response.end();
             return true;
        }

        // Catch-all for other GETs (invites etc) to prevent failure
        if (request.method === 'GET') {
             response.setHeader('Content-Type', 'application/json');
             response.write(JSON.stringify({ data: [] }));
             response.end();
             return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/mission', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        // Expectation: Oldest first (ascending by created)
        // Mission A (oldest), Mission B, Mission C (newest)

        assert.ok(res.body.items, 'Items should exist');
        assert.equal(res.body.items.length, 3);
        assert.equal(res.body.items[0].name, 'Mission A');
        assert.equal(res.body.items[1].name, 'Mission B');
        assert.equal(res.body.items[2].name, 'Mission C');
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/mission - Sorted List (Newest => Oldest)', async () => {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = request.url;

        if (request.method === 'GET' && url.includes('/Marti/api/missions') && !url.includes('invite')) {
             response.setHeader('Content-Type', 'application/json');
             // Return unordered list
             const mockMission = (name: string, createTime: string) => ({
                 name,
                 createTime,
                 uid: name,
                 guid: name,
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
                 groups: ['channel-1']
             });

             const missions = [
                 mockMission('Mission A', '2023-01-01T00:00:00Z'),
                 mockMission('Mission C', '2023-01-03T00:00:00Z'),
                 mockMission('Mission B', '2023-01-02T00:00:00Z')
             ];
             response.write(JSON.stringify({
                 data: missions,
                 count: 3
             }));
             response.end();
             return true;
        }

        // Catch-all for other GETs (invites etc) to prevent failure
        if (request.method === 'GET') {
             response.setHeader('Content-Type', 'application/json');
             response.write(JSON.stringify({ data: [] }));
             response.end();
             return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/mission?order=desc', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        // Expectation: Newest first (descending by created)
        // Mission C (newest), Mission B, Mission A (oldest)

        assert.ok(res.body.items, 'Items should exist');
        assert.equal(res.body.items.length, 3);
        assert.equal(res.body.items[0].name, 'Mission C');
        assert.equal(res.body.items[1].name, 'Mission B');
        assert.equal(res.body.items[2].name, 'Mission A');
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('GET: api/marti/mission - Filter Groups', async () => {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = request.url;

        if (request.method === 'GET' && url.includes('/Marti/api/missions') && !url.includes('invite')) {
             response.setHeader('Content-Type', 'application/json');
             // Return unordered list
             const mockMission = (name: string, createTime: string, groups: string[]) => ({
                 name,
                 createTime,
                 uid: name,
                 guid: name,
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
                 groups
             });

             const missions = [
                 mockMission('Mission A', '2023-01-01T00:00:00Z', ['group-a']),
                 mockMission('Mission C', '2023-01-03T00:00:00Z', ['group-a', 'group-b']),
                 mockMission('Mission B', '2023-01-02T00:00:00Z', ['group-b'])
             ];
             response.write(JSON.stringify({
                 data: missions,
                 count: 3
             }));
             response.end();
             return true;
        }

        // Catch-all for other GETs (invites etc) to prevent failure
        if (request.method === 'GET') {
             response.setHeader('Content-Type', 'application/json');
             response.write(JSON.stringify({ data: [] }));
             response.end();
             return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/mission?groups=group-a', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.ok(res.body.items, 'Items should exist');
        assert.equal(res.body.items.length, 2);
        // A (Jan 1) and C (Jan 3). Sorted A, C.
        assert.equal(res.body.items[0].name, 'Mission A');
        assert.equal(res.body.items[1].name, 'Mission C');

        const res2 = await flight.fetch('/api/marti/mission?groups=group-a,group-b', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.ok(res2.body.items, 'Items should exist');
        assert.equal(res2.body.items.length, 3);
        // A (Jan 1), B (Jan 2), C (Jan 3).
        assert.equal(res2.body.items[0].name, 'Mission A');
        assert.equal(res2.body.items[1].name, 'Mission B');
        assert.equal(res2.body.items[2].name, 'Mission C');

    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.landing();
