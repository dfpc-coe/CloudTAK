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

type Captured = { method: string; url: string };

function mockRole(captured: Captured[], status = 200): void {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;
        if (!request.url.startsWith(`/Marti/api/missions/guid/${GUID}/role`)) return false;

        captured.push({ method: request.method, url: request.url });

        response.statusCode = status;
        response.end();
        return true;
    });
}

test('DELETE: api/marti/missions/:guid/user - Remove via role-less PUT role', async () => {
    const captured: Captured[] = [];
    mockRole(captured);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/user?uid=ANDROID-123`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'User(s) Removed' });
        assert.equal(captured.length, 1);
        assert.equal(captured[0].method, 'PUT');
        assert.equal(captured[0].url, `/Marti/api/missions/guid/${GUID}/role?clientUid=ANDROID-123`);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid/user - Multiple UIDs', async () => {
    const captured: Captured[] = [];
    mockRole(captured);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/user?uid=ANDROID-123&uid=ANDROID-456`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { status: 200, message: 'User(s) Removed' });
        assert.deepEqual(captured.map(c => c.url), [
            `/Marti/api/missions/guid/${GUID}/role?clientUid=ANDROID-123`,
            `/Marti/api/missions/guid/${GUID}/role?clientUid=ANDROID-456`,
        ]);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('DELETE: api/marti/missions/:guid/user - TAK Server Forbidden', async () => {
    const captured: Captured[] = [];
    mockRole(captured, 403);

    try {
        const res = await flight.fetch(`/api/marti/missions/${GUID}/user?uid=ANDROID-123`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.notEqual(res.status, 200);
        assert.equal(captured.length, 1);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

flight.landing();
