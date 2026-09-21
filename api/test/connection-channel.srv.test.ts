import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import fs from 'fs';
import Sinon from 'sinon';
import Err from '@openaddresses/batch-error';
import CoTAKUser from '../stateless/lib/user/cotak.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

let connectionId: number = 0;

const channels = [
    { id: 1, rdn: 'channel-one', name: 'Channel One', description: 'First' },
    { id: 2, rdn: 'channel-two', name: 'Channel Two', description: 'Second' },
];

/**
 * Stub the calls made to the external provider, tracking membership in-memory
 * so that the validation & ordering logic of the provider is what is under test
 */
function stubProvider(members: Array<number>) {
    const cotak = flight.config!.user.get('cotak') as CoTAKUser;
    const calls: Array<string> = [];

    const stubs = [
        Sinon.stub(cotak, 'configured').get(() => true),
        Sinon.stub(cotak, 'fetchMachineUserChannels').callsFake(async () => {
            return {
                user: { id: 99, email: 'machine-user-1@example.com', integrations: [{ id: 5, name: 'Test' }] },
                channels: channels.filter(channel => members.includes(channel.id)),
            };
        }),
        Sinon.stub(cotak, 'attachMachineUserChannel').callsFake(async (uid, user_id, channel) => {
            calls.push(`attach:${channel.id}:${channel.access}`);
            members.push(channel.id);
        }),
        Sinon.stub(cotak, 'detachMachineUserChannel').callsFake(async (uid, user_id, channel_id) => {
            calls.push(`detach:${channel_id}`);
            members.splice(members.indexOf(channel_id), 1);
        }),
    ];

    return {
        calls,
        restore: () => stubs.forEach(stub => stub.restore()),
    };
}

test('Creating Connection', async () => {
    try {
        const conn = await flight.fetch('/api/connection', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Channel Connection',
                description: 'Connection created by Flight Test Runner',
                enabled: false,
                auth: {
                    cert: String(fs.readFileSync('/tmp/cloudtak-test-admin.cert')),
                    key: String(fs.readFileSync('/tmp/cloudtak-test-admin.key')),
                },
            },
        }, true);

        connectionId = conn.body.id;

        await flight.config!.models.Profile.commit('admin@example.com', { id: 1 });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/:connectionid/channel - No Auth', async () => {
    const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
        method: 'GET',
    }, false);

    assert.equal(res.status, 401);
});

test('GET: api/connection/:connectionid/channel - Non-admin without access', async () => {
    const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
        method: 'GET',
        auth: {
            bearer: flight.token.user,
        },
    }, false);

    assert.equal(res.status, 401);
    assert.equal(res.body.message, 'Only a System Admin can access this connection');
});

test('GET: api/connection/:connectionid/channel - Provider not configured', async () => {
    const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
        method: 'GET',
        auth: {
            bearer: flight.token.admin,
        },
    }, true);

    assert.deepEqual(res.body, { managed: false, total: 0, items: [] });
});

test('PATCH: api/connection/:connectionid/channel - Provider not configured', async () => {
    const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
        method: 'PATCH',
        auth: {
            bearer: flight.token.admin,
        },
        body: {
            detach: [1],
        },
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'External LDAP API not configured - Contact your administrator');
});

test('GET: api/connection/:connectionid/channel - No Machine User', async () => {
    const cotak = flight.config!.user.get('cotak') as CoTAKUser;
    // The provider is not reachable in tests so force the 404 that an unknown integration would produce
    const stubs = [
        Sinon.stub(cotak, 'configured').get(() => true),
        Sinon.stub(cotak, 'fetchMachineUserChannels').rejects(new Err(404, null, 'Connection is not managed by a Machine User')),
    ];

    try {
        const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { managed: false, total: 0, items: [] });
    } finally {
        stubs.forEach(stub => stub.restore());
    }
});

test('GET: api/connection/:connectionid/channel - Managed', async () => {
    const provider = stubProvider([1]);

    try {
        const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, { managed: true, total: 1, items: [channels[0]] });
    } finally {
        provider.restore();
    }
});

test('PATCH: api/connection/:connectionid/channel - Detach non-member', async () => {
    const provider = stubProvider([1]);

    try {
        const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                detach: [2],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Machine User is not a member of Channel 2');
        assert.deepEqual(provider.calls, []);
    } finally {
        provider.restore();
    }
});

test('PATCH: api/connection/:connectionid/channel - Attach existing member', async () => {
    const provider = stubProvider([1]);

    try {
        const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                attach: [{ id: 1, access: 'read' }],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Machine User is already a member of Channel 1');
        assert.deepEqual(provider.calls, []);
    } finally {
        provider.restore();
    }
});

test('PATCH: api/connection/:connectionid/channel - Cannot detach every channel', async () => {
    const provider = stubProvider([1]);

    try {
        const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                detach: [1],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Machine User must remain a member of at least one Channel');
        assert.deepEqual(provider.calls, []);
    } finally {
        provider.restore();
    }
});

test('PATCH: api/connection/:connectionid/channel - Swap channels attaches before detaching', async () => {
    const provider = stubProvider([1]);

    try {
        const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                attach: [{ id: 2, access: 'write' }],
                detach: [1],
            },
        }, true);

        assert.deepEqual(provider.calls, ['attach:2:write', 'detach:1']);
        assert.deepEqual(res.body, { total: 1, items: [channels[1]] });
    } finally {
        provider.restore();
    }
});

test('PATCH: api/connection/:connectionid/channel - Change access of existing membership', async () => {
    const provider = stubProvider([1]);

    try {
        const res = await flight.fetch(`/api/connection/${connectionId}/channel`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                attach: [{ id: 1, access: 'read' }],
                detach: [1],
            },
        }, true);

        assert.deepEqual(provider.calls, ['detach:1', 'attach:1:read']);
        assert.deepEqual(res.body, { total: 1, items: [channels[0]] });
    } finally {
        provider.restore();
    }
});

flight.landing();
