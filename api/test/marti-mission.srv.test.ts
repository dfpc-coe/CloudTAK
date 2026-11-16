process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

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
                groups: ['channel-1'],
            });

            const missions = [
                mockMission('Mission A', '2023-01-01T00:00:00Z'),
                mockMission('Mission C', '2023-01-03T00:00:00Z'),
                mockMission('Mission B', '2023-01-02T00:00:00Z'),
            ];
            response.write(JSON.stringify({
                data: missions,
                count: 3,
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
                bearer: flight.token.admin,
            },
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
    } finally {
        flight.tak.reset();
    }
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
                groups: ['channel-1'],
            });

            const missions = [
                mockMission('Mission A', '2023-01-01T00:00:00Z'),
                mockMission('Mission C', '2023-01-03T00:00:00Z'),
                mockMission('Mission B', '2023-01-02T00:00:00Z'),
            ];
            response.write(JSON.stringify({
                data: missions,
                count: 3,
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
                bearer: flight.token.admin,
            },
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
    } finally {
        flight.tak.reset();
    }
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
                groups,
            });

            const missions = [
                mockMission('Mission A', '2023-01-01T00:00:00Z', ['group-a']),
                mockMission('Mission C', '2023-01-03T00:00:00Z', ['group-a', 'group-b']),
                mockMission('Mission B', '2023-01-02T00:00:00Z', ['group-b']),
            ];
            response.write(JSON.stringify({
                data: missions,
                count: 3,
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
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(res.body.items, 'Items should exist');
        assert.equal(res.body.items.length, 2);
        // A (Jan 1) and C (Jan 3). Sorted A, C.
        assert.equal(res.body.items[0].name, 'Mission A');
        assert.equal(res.body.items[1].name, 'Mission C');

        const res2 = await flight.fetch('/api/marti/mission?groups=group-a,group-b', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(res2.body.items, 'Items should exist');
        assert.equal(res2.body.items.length, 3);
        // A (Jan 1), B (Jan 2), C (Jan 3).
        assert.equal(res2.body.items[0].name, 'Mission A');
        assert.equal(res2.body.items[1].name, 'Mission B');
        assert.equal(res2.body.items[2].name, 'Mission C');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PATCH: api/marti/missions/:guid - returns refreshed groups after update', async () => {
    let postedGroups: string[] = [];
    let missionAuthorization: string | undefined;
    let allowGroupChange: string | null = null;

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');

        if (
            request.method === 'GET'
            && (
                url.pathname === '/Marti/api/missions/Test%20Mission'
                || url.pathname === '/Marti/api/missions/test-mission-guid'
                || url.pathname === '/Marti/api/missions/guid/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71'
            )
        ) {
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                data: [{
                    name: 'Test Mission',
                    guid: 'test-mission-guid',
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
                    groups: ['original-group'],
                }],
            }));
            response.end();
            return true;
        }

        if (request.method === 'POST' && url.pathname === '/Marti/api/missions/Test%20Mission') {
            postedGroups = url.searchParams.getAll('group');
            missionAuthorization = request.headers['missionauthorization'] as string | undefined;
            allowGroupChange = url.searchParams.get('allowGroupChange');
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                data: [{
                    name: 'Test Mission',
                    guid: 'test-mission-guid',
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
                    groups: ['updated-group'],
                }],
            }));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/missions/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
            body: {
                groups: ['updated-group'],
            },
        }, true);

        assert.deepEqual(postedGroups, ['updated-group']);
        assert.equal(missionAuthorization, 'Bearer test-mission-token');
        assert.equal(allowGroupChange, 'true');
        assert.deepEqual(res.body.groups, ['updated-group']);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PATCH: api/marti/missions/:guid - forwards defaultRole and returns it', async () => {
    let posted: URLSearchParams | undefined;

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');

        if (
            request.method === 'GET'
            && url.pathname === '/Marti/api/missions/guid/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71'
        ) {
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                data: [{
                    name: 'Test Mission',
                    guid: '9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71',
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
                    defaultRole: { type: 'MISSION_SUBSCRIBER', permissions: ['MISSION_READ', 'MISSION_WRITE'] },
                    groups: ['original-group'],
                }],
            }));
            response.end();
            return true;
        }

        if (request.method === 'POST' && url.pathname === '/Marti/api/missions/Test%20Mission') {
            posted = url.searchParams;
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({
                data: [{
                    ...{
                        name: 'Test Mission',
                        guid: '9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71',
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
                        defaultRole: { type: 'MISSION_SUBSCRIBER', permissions: ['MISSION_READ', 'MISSION_WRITE'] },
                        groups: ['original-group'],
                    },
                    defaultRole: { type: 'MISSION_READONLY_SUBSCRIBER', permissions: ['MISSION_READ'] },
                }],
            }));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/missions/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                defaultRole: 'MISSION_READONLY_SUBSCRIBER',
            },
        }, true);

        assert.ok(posted);
        assert.equal(posted.get('defaultRole'), 'MISSION_READONLY_SUBSCRIBER');
        assert.equal(posted.get('description'), 'test description');
        assert.deepEqual(posted.getAll('group'), ['original-group']);
        assert.equal(res.body.defaultRole.type, 'MISSION_READONLY_SUBSCRIBER');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PATCH: api/marti/missions/:guid - rejects an unknown defaultRole', async () => {
    const res = await flight.fetch('/api/marti/missions/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71', {
        method: 'PATCH',
        auth: {
            bearer: flight.token.admin,
        },
        body: {
            defaultRole: 'MISSION_ADMIN',
        },
    }, false);

    assert.equal(res.status, 400);
});

const PASSWORD_MISSION = {
    name: 'Test Mission',
    guid: '9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71',
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
    defaultRole: { type: 'MISSION_SUBSCRIBER', permissions: ['MISSION_READ', 'MISSION_WRITE'] },
    groups: ['original-group'],
};

function mockPasswordMission(calls: Array<{ method: string; url: URL; auth?: string }>) {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://127.0.0.1');

        if (request.method === 'GET' && url.pathname === '/Marti/api/missions/guid/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71') {
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({ data: [PASSWORD_MISSION] }));
            response.end();
            return true;
        }

        if (request.method === 'POST' && url.pathname === '/Marti/api/missions/Test%20Mission') {
            calls.push({ method: request.method, url });
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({ data: [PASSWORD_MISSION] }));
            response.end();
            return true;
        }

        if (url.pathname === '/Marti/api/missions/guid/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71/password') {
            calls.push({
                method: request.method,
                url,
                auth: request.headers['missionauthorization'] as string | undefined,
            });
            response.statusCode = 200;
            response.end();
            return true;
        }

        return false;
    });
}

test('PATCH: api/marti/missions/:guid - a string password is set via the guid password endpoint', async () => {
    const calls: Array<{ method: string; url: URL; auth?: string }> = [];
    mockPasswordMission(calls);

    try {
        const res = await flight.fetch('/api/marti/missions/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
            body: {
                password: 'p%ss?w"rd',
            },
        }, true);

        const post = calls.find(c => c.method === 'POST');
        assert.ok(post);
        assert.equal(post.url.searchParams.has('password'), false);

        const set = calls.find(c => c.url.pathname.endsWith('/password'));
        assert.ok(set);
        assert.equal(set.method, 'PUT');
        assert.equal(set.url.searchParams.get('password'), 'p%ss?w"rd');
        assert.ok(set.url.searchParams.get('creatorUid'));
        assert.equal(set.auth, 'Bearer test-mission-token');
        assert.equal(res.body.passwordProtected, true);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PATCH: api/marti/missions/:guid - a null password removes it via the guid password endpoint', async () => {
    const calls: Array<{ method: string; url: URL; auth?: string }> = [];
    mockPasswordMission(calls);

    try {
        const res = await flight.fetch('/api/marti/missions/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                password: null,
            },
        }, true);

        const remove = calls.find(c => c.url.pathname.endsWith('/password'));
        assert.ok(remove);
        assert.equal(remove.method, 'DELETE');
        assert.equal(remove.url.searchParams.has('password'), false);
        assert.ok(remove.url.searchParams.get('creatorUid'));
        assert.equal(res.body.passwordProtected, false);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PATCH: api/marti/missions/:guid - rejects an empty password', async () => {
    const calls: Array<{ method: string; url: URL; auth?: string }> = [];
    mockPasswordMission(calls);

    try {
        const res = await flight.fetch('/api/marti/missions/9d2b7a6e-3c4f-4e8a-9b1d-2f6a8c0e4b71', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                password: '',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(calls.length, 0);
    } finally {
        flight.tak.reset();
    }
});

flight.landing();
