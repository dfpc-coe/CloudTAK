process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.connection();

const GUID = '6840f919-76f1-4f46-a61c-46055ff0ed30';

function json(response: ServerResponse, body: unknown, status = 200): true {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.write(JSON.stringify(body));
    response.end();
    return true;
}

test('POST: api/connection/1/data - Data Sync name is trimmed before the TAK Server Mission is created', async () => {
    const requests: string[] = [];

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');
        requests.push(`${request.method} ${url.pathname}`);

        if (request.method === 'GET' && url.pathname === '/Marti/api/missions/CAIC%20Avalanche%20Forecast') {
            return json(response, { error: 'Mission not found' }, 404);
        } else if (request.method === 'POST' && url.pathname === '/Marti/api/missions/CAIC%20Avalanche%20Forecast') {
            return json(response, {
                version: '3',
                type: 'Mission',
                data: [{
                    name: 'CAIC Avalanche Forecast',
                    description: '',
                    chatRoom: '',
                    baseLayer: '',
                    bbox: '',
                    path: '',
                    classification: '',
                    tool: 'public',
                    keywords: [],
                    creatorUid: 'connection-1-data-1',
                    createTime: '2026-11-05T21:54:52.177Z',
                    externalData: [],
                    feeds: [],
                    mapLayers: [],
                    defaultRole: { type: 'MISSION_SUBSCRIBER', permissions: ['MISSION_READ', 'MISSION_WRITE'] },
                    inviteOnly: false,
                    expiration: -1,
                    guid: GUID,
                    uids: [],
                    contents: [],
                    passwordProtected: false,
                    token: 'mission-token',
                    groups: ['Test Group'],
                }],
                nodeId: 'mock',
            });
        } else if (request.method === 'PUT' && url.pathname === `/Marti/api/missions/guid/${GUID}/subscription`) {
            return json(response, {
                version: '3',
                type: 'MissionSubscription',
                data: {
                    token: 'subscription-token',
                    clientUid: url.searchParams.get('uid'),
                    username: 'alice',
                    createTime: '2026-11-05T21:54:52.648Z',
                    role: { type: 'MISSION_OWNER', permissions: ['MISSION_READ', 'MISSION_WRITE', 'MISSION_DELETE', 'MISSION_SET_ROLE', 'MISSION_SET_PASSWORD'] },
                },
                nodeId: 'mock',
            });
        } else if (request.method === 'GET' && url.pathname === `/Marti/api/missions/guid/${GUID}/layers`) {
            return json(response, { version: '3', type: 'MissionLayer', data: [], nodeId: 'mock' });
        }

        return false;
    });

    let dataId: number | undefined;

    try {
        const res = await flight.fetch('/api/connection/1/data', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: ' CAIC Avalanche Forecast ',
                description: 'Padded name',
                mission_sync: true,
            },
        }, true);

        dataId = res.body.id;

        assert.equal(res.body.name, 'CAIC Avalanche Forecast');
        assert.equal(res.body.mission_exists, true, res.body.mission_error);

        const stored = await flight.config!.models.Data.from(res.body.id);
        assert.equal(stored.name, 'CAIC Avalanche Forecast');
        assert.equal(stored.mission_guid, GUID);

        assert.ok(requests.includes('POST /Marti/api/missions/CAIC%20Avalanche%20Forecast'), requests.join('\n'));
        assert.ok(requests.includes(`PUT /Marti/api/missions/guid/${GUID}/subscription`), requests.join('\n'));
    } catch (err) {
        assert.ifError(err);
    } finally {
        if (dataId !== undefined) await flight.config!.models.Data.delete(dataId);
        flight.tak.reset();
    }
});
