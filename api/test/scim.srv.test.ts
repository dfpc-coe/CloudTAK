import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { eq } from 'drizzle-orm';
import { ProfileSession } from '../common/schema.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const SCIM_TOKEN = 'scim-test-token-1234567890';

test('GET: api/scim/v2/Users - SCIM disabled', async () => {
    const res = await flight.fetch('/api/scim/v2/Users', {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, false);

    assert.equal(res.status, 403);
    assert.deepEqual(res.body, {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '403',
        detail: 'SCIM provisioning is not enabled',
    });
});

test('PUT: api/config - enable SCIM', async () => {
    const res = await flight.fetch('/api/config', {
        method: 'PUT',
        auth: { bearer: flight.token.admin },
        body: {
            'scim::enabled': true,
            'scim::token': SCIM_TOKEN,
        },
    }, true);

    assert.deepEqual(res.body, {
        'scim::enabled': true,
        'scim::token': SCIM_TOKEN,
    });
});

test('GET: api/scim/v2/Users - invalid token', async () => {
    const res = await flight.fetch('/api/scim/v2/Users', {
        method: 'GET',
        auth: { bearer: 'not-the-token' },
    }, false);

    assert.equal(res.status, 401);
    assert.equal(res.body.detail, 'Invalid SCIM token');

    const user = await flight.fetch('/api/scim/v2/Users', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, false);

    assert.equal(user.status, 401, 'CloudTAK user tokens are not SCIM tokens');
});

test('GET: api/scim/v2/ServiceProviderConfig', async () => {
    const res = await flight.fetch('/api/scim/v2/ServiceProviderConfig', {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(res.headers.get('content-type'), 'application/scim+json; charset=utf-8');
    assert.equal(res.body.patch.supported, true);
    assert.equal(res.body.filter.supported, true);
});

test('GET: api/scim/v2/Users', async () => {
    const res = await flight.fetch('/api/scim/v2/Users', {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(res.body.totalResults, 1);
    assert.equal(res.body.startIndex, 1);
    assert.equal(res.body.itemsPerPage, 1);
    assert.equal(res.body.Resources[0].id, 'admin@example.com');
    assert.equal(res.body.Resources[0].active, true);
});

test('POST: api/scim/v2/Users', async () => {
    const res = await flight.fetch('/api/scim/v2/Users', {
        method: 'POST',
        auth: { bearer: SCIM_TOKEN },
        body: {
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
            userName: 'SCIM.User@example.com',
            externalId: 'idp-1234',
            name: {
                givenName: 'Scim',
                familyName: 'User',
            },
            displayName: 'SCIM1',
            emails: [{ value: 'scim.user@example.com', primary: true }],
            active: true,
        },
    }, true);

    assert.equal(res.status, 201);

    const provisioned = await flight.config!.models.Profile.from('scim.user@example.com');
    assert.equal(provisioned.auth, null, 'provisioned users have no auth until first login');

    assert.ok(res.body.meta.created);
    assert.ok(res.body.meta.lastModified);
    assert.ok(res.body.meta.location.endsWith('/api/scim/v2/Users/scim.user%40example.com'), res.body.meta.location);
    delete res.body.meta.created;
    delete res.body.meta.lastModified;
    delete res.body.meta.location;

    assert.deepEqual(res.body, {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        id: 'scim.user@example.com',
        userName: 'scim.user@example.com',
        name: { formatted: 'Scim User' },
        displayName: 'SCIM1',
        emails: [{ value: 'scim.user@example.com', type: 'work', primary: true }],
        active: true,
        meta: {
            resourceType: 'User',
        },
    });
});

test('POST: api/scim/v2/Users - duplicate', async () => {
    const res = await flight.fetch('/api/scim/v2/Users', {
        method: 'POST',
        auth: { bearer: SCIM_TOKEN },
        body: {
            userName: 'scim.user@example.com',
        },
    }, false);

    assert.equal(res.status, 409);
    assert.deepEqual(res.body, {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '409',
        scimType: 'uniqueness',
        detail: 'User scim.user@example.com already exists',
    });
});

test('GET: api/scim/v2/Users?filter', async () => {
    const res = await flight.fetch(`/api/scim/v2/Users?filter=${encodeURIComponent('userName eq "SCIM.User@example.com"')}`, {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(res.body.totalResults, 1);
    assert.equal(res.body.Resources[0].id, 'scim.user@example.com');

    const missing = await flight.fetch(`/api/scim/v2/Users?filter=${encodeURIComponent('userName eq "nobody@example.com"')}`, {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(missing.body.totalResults, 0);
    assert.deepEqual(missing.body.Resources, []);

    const bad = await flight.fetch(`/api/scim/v2/Users?filter=${encodeURIComponent('displayName co "S"')}`, {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, false);

    assert.equal(bad.status, 400);
    assert.equal(bad.body.scimType, 'invalidFilter');
});

test('GET: api/scim/v2/Users - paging', async () => {
    const res = await flight.fetch('/api/scim/v2/Users?startIndex=2&count=1', {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(res.body.totalResults, 2);
    assert.equal(res.body.startIndex, 2);
    assert.equal(res.body.itemsPerPage, 1);
    assert.equal(res.body.Resources[0].id, 'scim.user@example.com');
});

test('GET: api/scim/v2/Users/:id', async () => {
    const res = await flight.fetch('/api/scim/v2/Users/scim.user%40example.com', {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(res.body.id, 'scim.user@example.com');
    assert.equal(res.body.active, true);

    const missing = await flight.fetch('/api/scim/v2/Users/nobody%40example.com', {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, false);

    assert.equal(missing.status, 404);
    assert.equal(missing.body.status, '404');
});

test('PATCH: api/scim/v2/Users/:id - deactivate', async () => {
    await flight.config!.models.ProfileSession.generate({
        username: 'scim.user@example.com',
        ip: '127.0.0.1',
        device_type: 'Desktop',
        browser: 'Test',
        os: 'Test',
        user_agent: 'Test',
    });

    const res = await flight.fetch('/api/scim/v2/Users/scim.user%40example.com', {
        method: 'PATCH',
        auth: { bearer: SCIM_TOKEN },
        body: {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{
                op: 'Replace',
                path: 'active',
                value: 'False',
            }, {
                op: 'replace',
                path: 'displayName',
                value: 'SCIM2',
            }, {
                op: 'add',
                path: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User:department',
                value: 'Ignored',
            }],
        },
    }, true);

    assert.equal(res.body.active, false);
    assert.equal(res.body.displayName, 'SCIM2');

    const sessions = await flight.config!.models.ProfileSession.count({
        where: eq(ProfileSession.username, 'scim.user@example.com'),
    });
    assert.equal(sessions, 0, 'sessions are revoked on deactivation');
});

flight.server('admin@example.com', 'password123');

test('POST: api/login - disabled user', async () => {
    const res = await flight.fetch('/api/login', {
        method: 'POST',
        body: {
            username: 'scim.user@example.com',
            password: 'password123',
        },
    }, false);

    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'User is disabled - Contact your administrator');
});

test('PATCH: api/scim/v2/Users/:id - reactivate without path', async () => {
    const res = await flight.fetch('/api/scim/v2/Users/scim.user%40example.com', {
        method: 'PATCH',
        auth: { bearer: SCIM_TOKEN },
        body: {
            Operations: [{
                op: 'replace',
                value: {
                    'active': true,
                    'name.formatted': 'Scim Renamed',
                },
            }],
        },
    }, true);

    assert.equal(res.body.active, true);
    assert.equal(res.body.name.formatted, 'Scim Renamed');
});

test('POST: api/login - provisioned user first login', async () => {
    const res = await flight.fetch('/api/login', {
        method: 'POST',
        body: {
            username: 'scim.user@example.com',
            password: 'password123',
        },
    }, false);

    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.email, 'scim.user@example.com');
    assert.equal(res.body.access, 'user');

    const profile = await flight.config!.models.Profile.from('scim.user@example.com');
    assert.ok(profile.auth?.cert, 'certificate issued on first login');
});

test('PUT: api/scim/v2/Users/:id', async () => {
    const res = await flight.fetch('/api/scim/v2/Users/scim.user%40example.com', {
        method: 'PUT',
        auth: { bearer: SCIM_TOKEN },
        body: {
            userName: 'scim.user@example.com',
            name: { formatted: 'Scim Replaced' },
            displayName: 'SCIM3',
            active: true,
        },
    }, true);

    assert.equal(res.body.name.formatted, 'Scim Replaced');
    assert.equal(res.body.displayName, 'SCIM3');
    assert.equal(res.body.active, true);

    const rename = await flight.fetch('/api/scim/v2/Users/scim.user%40example.com', {
        method: 'PUT',
        auth: { bearer: SCIM_TOKEN },
        body: {
            userName: 'renamed@example.com',
        },
    }, false);

    assert.equal(rename.status, 400);
    assert.equal(rename.body.scimType, 'mutability');
});

test('DELETE: api/scim/v2/Users/:id', async () => {
    const res = await flight.fetch('/api/scim/v2/Users/scim.user%40example.com', {
        method: 'DELETE',
        auth: { bearer: SCIM_TOKEN },
    }, { json: false });

    assert.equal(res.status, 204);

    const user = await flight.fetch('/api/scim/v2/Users/scim.user%40example.com', {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(user.body.active, false);

    const admin = await flight.fetch('/api/user/scim.user@example.com', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.equal(admin.body.disabled, true);
    assert.equal(admin.body.tak_callsign, 'SCIM3');
});

const groupId = Buffer.from('Firefighters', 'utf8').toString('base64url');

test('POST: api/scim/v2/Groups', async () => {
    const res = await flight.fetch('/api/scim/v2/Groups', {
        method: 'POST',
        auth: { bearer: SCIM_TOKEN },
        body: {
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
            displayName: 'Firefighters',
            externalId: 'idp-group-1',
            members: [{ value: 'SCIM.User@example.com', display: 'Scim User' }],
        },
    }, true);

    assert.equal(res.status, 201);
    assert.ok(res.body.meta.location.endsWith(`/api/scim/v2/Groups/${groupId}`));
    delete res.body.meta;

    assert.deepEqual(res.body, {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
        id: groupId,
        displayName: 'Firefighters',
        externalId: 'idp-group-1',
        members: [{ value: 'scim.user@example.com', display: 'scim.user@example.com' }],
    });

    const again = await flight.fetch('/api/scim/v2/Groups', {
        method: 'POST',
        auth: { bearer: SCIM_TOKEN },
        body: { displayName: 'Firefighters' },
    }, true);

    assert.equal(again.status, 201, 'Groups are not stored so a repeat create is accepted');
    assert.equal(again.body.id, groupId);
});

test('GET: api/scim/v2/Groups', async () => {
    const res = await flight.fetch('/api/scim/v2/Groups', {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(res.body.totalResults, 0);
    assert.deepEqual(res.body.Resources, []);

    const filtered = await flight.fetch(`/api/scim/v2/Groups?filter=${encodeURIComponent('displayName eq "Firefighters"')}`, {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(filtered.body.totalResults, 1);
    assert.equal(filtered.body.Resources[0].id, groupId);
    assert.deepEqual(filtered.body.Resources[0].members, []);

    const external = await flight.fetch(`/api/scim/v2/Groups?filter=${encodeURIComponent('externalId eq "idp-group-1"')}`, {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(external.body.totalResults, 0);

    const bad = await flight.fetch(`/api/scim/v2/Groups?filter=${encodeURIComponent('displayName co "Fire"')}`, {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, false);

    assert.equal(bad.status, 400);
    assert.equal(bad.body.scimType, 'invalidFilter');
});

test('GET: api/scim/v2/Groups/:id', async () => {
    const res = await flight.fetch(`/api/scim/v2/Groups/${groupId}`, {
        method: 'GET',
        auth: { bearer: SCIM_TOKEN },
    }, true);

    assert.equal(res.body.displayName, 'Firefighters');
    assert.deepEqual(res.body.members, []);

    for (const id of ['AAAA', 'not-a-group!']) {
        const missing = await flight.fetch(`/api/scim/v2/Groups/${id}`, {
            method: 'GET',
            auth: { bearer: SCIM_TOKEN },
        }, false);

        assert.equal(missing.status, 404, `Group id "${id}" is not found`);
    }
});

test('PATCH: api/scim/v2/Groups/:id', async () => {
    const res = await flight.fetch(`/api/scim/v2/Groups/${groupId}`, {
        method: 'PATCH',
        auth: { bearer: SCIM_TOKEN },
        body: {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{
                op: 'add',
                path: 'members',
                value: [{ value: 'admin@example.com' }, { value: 'SCIM.User@example.com' }],
            }, {
                op: 'remove',
                path: 'members[value eq "scim.user@example.com"]',
            }, {
                op: 'replace',
                path: 'displayName',
                value: 'Wildland Firefighters',
            }],
        },
    }, true);

    assert.equal(res.body.displayName, 'Wildland Firefighters');
    assert.equal(res.body.id, Buffer.from('Wildland Firefighters', 'utf8').toString('base64url'));
    assert.deepEqual(res.body.members.map((m: { value: string }) => m.value), ['admin@example.com']);
});

test('PUT: api/scim/v2/Groups/:id', async () => {
    const res = await flight.fetch(`/api/scim/v2/Groups/${groupId}`, {
        method: 'PUT',
        auth: { bearer: SCIM_TOKEN },
        body: {
            displayName: 'Firefighters',
            members: [{ value: 'scim.user@example.com' }],
        },
    }, true);

    assert.equal(res.body.displayName, 'Firefighters');
    assert.equal(res.body.externalId, undefined);
    assert.deepEqual(res.body.members, [{ value: 'scim.user@example.com', display: 'scim.user@example.com' }]);

    const missing = await flight.fetch('/api/scim/v2/Groups/AAAA', {
        method: 'PUT',
        auth: { bearer: SCIM_TOKEN },
        body: { displayName: 'Firefighters' },
    }, false);

    assert.equal(missing.status, 404);
});

test('DELETE: api/scim/v2/Groups/:id', async () => {
    const res = await flight.fetch(`/api/scim/v2/Groups/${groupId}`, {
        method: 'DELETE',
        auth: { bearer: SCIM_TOKEN },
    }, { json: false });

    assert.equal(res.status, 204);

    const missing = await flight.fetch('/api/scim/v2/Groups/AAAA', {
        method: 'DELETE',
        auth: { bearer: SCIM_TOKEN },
    }, false);

    assert.equal(missing.status, 404);
});

test('POST: api/scim/v2/Users - application/scim+json', async () => {
    const res = await flight.fetch('/api/scim/v2/Users', {
        method: 'POST',
        auth: { bearer: SCIM_TOKEN },
        headers: {
            'Content-Type': 'application/scim+json',
        },
        body: JSON.stringify({
            schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
            userName: 'scim.json@example.com',
            displayName: 'SCIM JSON',
        }),
    }, true);

    assert.equal(res.status, 201);
    assert.equal(res.headers.get('content-type'), 'application/scim+json; charset=utf-8');
    assert.equal(res.body.userName, 'scim.json@example.com');
    assert.equal(res.body.displayName, 'SCIM JSON');
});

test('PATCH: api/scim/v2/Users/:id - application/scim+json', async () => {
    const res = await flight.fetch('/api/scim/v2/Users/scim.json%40example.com', {
        method: 'PATCH',
        auth: { bearer: SCIM_TOKEN },
        headers: {
            'Content-Type': 'application/scim+json',
        },
        body: JSON.stringify({
            schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
            Operations: [{ op: 'replace', path: 'active', value: false }],
        }),
    }, true);

    assert.equal(res.status, 200);
    assert.equal(res.body.active, false);
});

flight.landing();
