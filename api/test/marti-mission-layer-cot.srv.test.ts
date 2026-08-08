process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

async function readBody(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks).toString();
}

test('PUT: api/marti/missions/:name/layer/:uid/cot - Attach CoTs to Layer', async () => {
    let capturedBody: unknown;
    let creatorUid: string | null = null;

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'PUT' && url.pathname === '/Marti/api/missions/Test%20Mission/contents') {
            creatorUid = url.searchParams.get('creatorUid');
            capturedBody = JSON.parse(await readBody(request));

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({ data: [] }));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/missions/Test Mission/layer/layer-1/cot', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
            body: {
                uids: ['cot-1', 'cot-2'],
            },
        }, true);

        assert.equal(res.body.status, 200);
        assert.equal(res.body.message, 'CoTs Attached to Layer');
        assert.equal(creatorUid, 'admin@example.com');
        assert.deepEqual(capturedBody, {
            paths: {
                'layer-1': [{ uids: ['cot-1', 'cot-2'] }],
            },
        });
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

test('DELETE: api/marti/missions/:name/layer/:uid/cot/:cotuid - Detach CoT from Layer', async () => {
    let layerUids: string[] = [];
    let parentUid: string | null = null;
    let creatorUid: string | null = null;

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'PUT' && url.pathname === '/Marti/api/missions/Test%20Mission/layers/parent') {
            layerUids = url.searchParams.getAll('layerUid');
            parentUid = url.searchParams.get('parentUid');
            creatorUid = url.searchParams.get('creatorUid');

            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({}));
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/missions/Test Mission/layer/layer-1/cot/cot-1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
        }, true);

        assert.equal(res.body.status, 200);
        assert.equal(res.body.message, 'CoT Detached from Layer');
        assert.deepEqual(layerUids, ['cot-1']);
        assert.equal(parentUid, null);
        assert.equal(creatorUid, 'admin@example.com');
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.landing();
