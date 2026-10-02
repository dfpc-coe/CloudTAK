process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const GUID = '9ba05e1d-970f-49e1-a153-7216fecf5279';

type Captured = { method: string; url: string; body: string };

/**
 * Register a mock for the Mission Properties endpoints and record every request made to them
 */
function mockProperties(captured: Captured[], data: unknown): void {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;
        if (!request.url.includes(`/Marti/api/missions/guid/${GUID}/properties`)) return false;

        let body = '';
        for await (const chunk of request) body += chunk;

        captured.push({ method: request.method, url: request.url, body });

        if (request.method === 'DELETE') {
            response.setHeader('Content-Type', 'text/plain');
            response.end();
            return true;
        }

        response.setHeader('Content-Type', 'application/json');
        response.write(JSON.stringify({
            version: '3',
            type: 'com.bbn.marti.sync.model.MissionProperty',
            data,
        }));
        response.end();
        return true;
    });
}

test('GET: api/marti/missions/:guid/property - List with prefix', async () => {
    const captured: Captured[] = [];
    mockProperties(captured, [{ key: 'test.a', value: '1' }, { key: 'test.b', value: '2' }]);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/property?prefix=test.`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 2,
            items: [{ key: 'test.a', value: '1' }, { key: 'test.b', value: '2' }],
        });

        assert.equal(captured.length, 1);
        assert.equal(captured[0].method, 'GET');
        assert.equal(captured[0].url, `/Marti/api/missions/guid/${GUID}/properties?prefix=test.`);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/missions/:guid/property/:key - Get', async () => {
    const captured: Captured[] = [];
    mockProperties(captured, { key: 'test.a', value: '1' });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/property/test.a`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body.data, { key: 'test.a', value: '1' });
        assert.equal(captured[0].url, `/Marti/api/missions/guid/${GUID}/properties/test.a`);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('PUT: api/marti/missions/:guid/property - Set uses the user as creatorUid', async () => {
    const captured: Captured[] = [];
    mockProperties(captured, { key: 'test.a', value: '1' });

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/property`, {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                key: 'test.a',
                value: '1',
            },
        }, true);

        assert.deepEqual(res.body.data, { key: 'test.a', value: '1' });

        assert.equal(captured[0].method, 'PUT');
        assert.equal(captured[0].url, `/Marti/api/missions/guid/${GUID}/properties?creatorUid=admin%40example.com`);
        assert.deepEqual(JSON.parse(captured[0].body), { key: 'test.a', value: '1' });
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid/property/:key - Delete', async () => {
    const captured: Captured[] = [];
    mockProperties(captured, null);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/property/test.a`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Property Deleted' });
        assert.equal(captured[0].method, 'DELETE');
        assert.equal(captured[0].url, `/Marti/api/missions/guid/${GUID}/properties/test.a?creatorUid=admin%40example.com`);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid/property - Delete All', async () => {
    const captured: Captured[] = [];
    mockProperties(captured, null);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/property`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'Properties Deleted' });
        assert.equal(captured[0].method, 'DELETE');
        assert.equal(captured[0].url, `/Marti/api/missions/guid/${GUID}/properties?creatorUid=admin%40example.com`);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

flight.landing();
