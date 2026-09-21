import test from 'node:test';
import assert from 'node:assert';
import Sinon from 'sinon';
import { sql } from 'drizzle-orm';
import {
    S3Client,
    ListObjectsV2Command,
    DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString();

test('GET: api/user', async () => {
    try {
        const res = await flight.fetch('/api/user', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        res.body.items.forEach((i: {
            last_login: string;
            created: string;
            updated: string;
            certificate?: { subject: string; validFrom: string; validTo: string };
        }) => {
            i.last_login = time;
            i.created = time;
            i.updated = time;

            assert.ok(i.certificate, 'certificate metadata is returned');
            assert.deepEqual(Object.keys(i.certificate).sort(), ['subject', 'validFrom', 'validTo']);
            assert.ok(!Number.isNaN(Date.parse(i.certificate.validTo)));
            delete i.certificate;
        });

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                active: false,
                username: 'admin@example.com',
                name: 'Unknown',
                last_login: time,
                created: time,
                updated: time,
                disabled: false,
                system_admin: true,
                agency_admin: [],
            }],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/user?disabled', async () => {
    await flight.config!.models.Profile.generate({
        username: 'disabled@example.com',
        auth: null,
        last_login: null,
        disabled: true,
    });

    const disabled = await flight.fetch('/api/user?disabled=true', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.equal(disabled.body.total, 1);
    assert.deepEqual(disabled.body.items.map((i: { username: string }) => i.username), ['disabled@example.com']);

    const enabled = await flight.fetch('/api/user?disabled=false', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.equal(enabled.body.total, 1);
    assert.deepEqual(enabled.body.items.map((i: { username: string }) => i.username), ['admin@example.com']);

    const all = await flight.fetch('/api/user', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);

    assert.equal(all.body.total, 2);

    const usernames = (res: { body: { items: Array<{ username: string }> } }) => res.body.items.map(i => i.username);

    // A never-logged-in user sorts after real logins when most recent first, and before them when oldest first
    const recent = await flight.fetch('/api/user?sort=last_login&order=desc', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);
    assert.deepEqual(usernames(recent), ['admin@example.com', 'disabled@example.com']);

    const oldest = await flight.fetch('/api/user?sort=last_login&order=asc', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);
    assert.deepEqual(usernames(oldest), ['disabled@example.com', 'admin@example.com']);

    await flight.config!.models.Profile.commit('disabled@example.com', { name: 'Aaron' });

    const nameAsc = await flight.fetch('/api/user?sort=name&order=asc', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);
    assert.deepEqual(usernames(nameAsc), ['disabled@example.com', 'admin@example.com']);

    const nameDesc = await flight.fetch('/api/user?sort=name&order=desc', {
        method: 'GET',
        auth: { bearer: flight.token.admin },
    }, true);
    assert.deepEqual(usernames(nameDesc), ['admin@example.com', 'disabled@example.com']);

    await flight.config!.models.Profile.delete('disabled@example.com');
});

test('PATCH: api/user/admin@example.com', async () => {
    try {
        const res = await flight.fetch('/api/user/admin@example.com', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                tak_callsign: 'New Callsign',
            },
        }, true);

        res.body.last_login = time;
        res.body.created = time;
        res.body.updated = time;

        assert.ok(res.body.certificate, 'certificate metadata is returned');
        delete res.body.certificate;

        assert.deepEqual(res.body, {
            active: false,
            username: 'admin@example.com',
            last_login: time,
            created: time,
            updated: time,
            tak_phone: '',
            menu_order: [],
            tak_callsign: 'New Callsign',
            tak_remarks: 'CloudTAK User',
            tak_group: 'Orange',
            tak_role: 'Team Member',
            tak_type: 'a-f-G-E-V-C',
            tak_loc: null,
            tak_loc_freq: 2000,
            display_stale: '10 Minutes',
            display_distance: 'mile',
            display_elevation: 'feet',
            display_speed: 'mi/h',
            display_projection: 'globe',
            display_radiation_dose: 'sieverts',
            display_wakelock: 'Charging',
            display_zoom: 'conditional',
            display_style: 'System Default',
            display_coordinate: 'dd',
            display_text: 'Medium',
            display_icon_rotation: true,
            geometry_point_type: 'u-d-p',
            geometry_point_color: '#ff0000',
            geometry_point_icon: '',
            disabled: false,
            system_admin: true,
            agency_admin: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/user/admin@example.com', async () => {
    try {
        const res = await flight.fetch('/api/user/admin@example.com', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        res.body.last_login = time;
        res.body.created = time;
        res.body.updated = time;

        assert.ok(res.body.certificate, 'certificate metadata is returned');
        assert.deepEqual(Object.keys(res.body.certificate).sort(), ['known', 'revoked', 'subject', 'validFrom', 'validTo']);
        assert.ok(!Number.isNaN(Date.parse(res.body.certificate.validTo)));
        assert.ok(!('auth' in res.body), 'private key material is never returned');
        delete res.body.certificate;

        assert.deepEqual(res.body, {
            active: false,
            username: 'admin@example.com',
            last_login: time,
            created: time,
            updated: time,
            menu_order: [],
            tak_phone: '',
            tak_callsign: 'New Callsign',
            tak_remarks: 'CloudTAK User',
            tak_group: 'Orange',
            tak_role: 'Team Member',
            tak_type: 'a-f-G-E-V-C',
            tak_loc: null,
            tak_loc_freq: 2000,
            display_stale: '10 Minutes',
            display_distance: 'mile',
            display_elevation: 'feet',
            display_speed: 'mi/h',
            display_projection: 'globe',
            display_radiation_dose: 'sieverts',
            display_wakelock: 'Charging',
            display_zoom: 'conditional',
            display_style: 'System Default',
            display_coordinate: 'dd',
            display_text: 'Medium',
            display_icon_rotation: true,
            geometry_point_type: 'u-d-p',
            geometry_point_color: '#ff0000',
            geometry_point_icon: '',
            disabled: false,
            system_admin: true,
            agency_admin: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/user/:username - disabled', async () => {
    await flight.config!.models.Profile.generate({
        username: 'toggle@example.com',
        auth: null,
        last_login: null,
    });

    const session = await flight.config!.models.ProfileSession.generate({
        username: 'toggle@example.com',
        ip: '127.0.0.1',
        device_type: 'desktop',
        browser: 'Test',
        os: 'Test',
        user_agent: 'Test',
    });

    const disabled = await flight.fetch('/api/user/toggle@example.com', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: { disabled: true },
    }, true);

    assert.equal(disabled.body.disabled, true);

    await assert.rejects(
        flight.config!.models.ProfileSession.from(session.id),
        'login sessions are removed when a user is disabled',
    );

    const enabled = await flight.fetch('/api/user/toggle@example.com', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: { disabled: false },
    }, true);

    assert.equal(enabled.body.disabled, false);

    const self = await flight.fetch('/api/user/admin@example.com', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: { disabled: true },
    }, false);

    assert.equal(self.status, 400);
    assert.equal(self.body.message, 'A System Administrator cannot disable their own account');

    await flight.config!.models.Profile.delete('toggle@example.com');
});

test('DELETE: api/user/:username', async () => {
    const username = 'erase@example.com';
    const models = flight.config!.models;

    await models.Profile.generate({ username, name: 'Erase Me', auth: null, last_login: null });
    await models.ProfileConfig.commit(username, { 'tak::callsign': 'Erase Me' });
    await models.ProfileToken.generate({ username, name: 'Token', token: 'etl.erase' });
    await models.ProfileChat.generate({
        username,
        chatroom: 'Room',
        sender_callsign: 'Erase Me',
        sender_uid: 'ANDROID-erase',
        message_id: 'erase-message',
        message: 'Personal Message',
    });
    await models.ProfileFile.generate({ username, name: 'file.kml', size: 1 });

    const connection = await models.Connection.generate({
        name: 'Erased User Connection',
        description: '',
        username,
        auth: { cert: 'cert', key: 'key' },
    });

    const mismatch = await flight.fetch(`/api/user/${username}?username=other@example.com`, {
        method: 'DELETE',
        auth: { bearer: flight.token.admin },
    }, false);

    assert.equal(mismatch.status, 400);

    const self = await flight.fetch('/api/user/admin@example.com?username=admin@example.com', {
        method: 'DELETE',
        auth: { bearer: flight.token.admin },
    }, false);

    assert.equal(self.status, 400);
    assert.equal(self.body.message, 'A System Administrator cannot erase their own account');

    const deleted: string[] = [];
    let listed = false;

    const stub = Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
        if (command instanceof ListObjectsV2Command) {
            assert.equal(command.input.Prefix, `profile/${username}/`);

            // The first listing returns the stored object and later listings are empty once it is deleted
            if (deleted.length) return Promise.resolve({ Contents: [] });
            listed = true;
            return Promise.resolve({ Contents: [{ Key: `profile/${username}/file.kml` }] });
        } else if (command instanceof DeleteObjectsCommand) {
            deleted.push(...(command.input.Delete?.Objects || []).map(object => String(object.Key)));
            return Promise.resolve({});
        }

        throw new Error(`Unknown S3 Command: ${command.constructor.name}`);
    });

    try {
        const res = await flight.fetch(`/api/user/${username}?username=${username}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body.message, 'User Erased');
        assert.match(res.body.username, /^erased-[0-9a-f-]{36}$/);

        assert.ok(listed, 'stored objects are listed');
        assert.deepEqual(deleted, [`profile/${username}/file.kml`]);

        await assert.rejects(models.Profile.from(username), 'the username no longer exists');

        const erased = await models.Profile.from(res.body.username);
        assert.equal(erased.name, 'Erased User');
        assert.equal(erased.disabled, true);
        assert.equal(erased.auth, null);

        for (const model of [models.ProfileToken, models.ProfileChat, models.ProfileFile]) {
            assert.equal(await model.count({
                where: sql`username IN (${username}, ${res.body.username})`,
            }), 0);
        }

        assert.deepEqual(await models.ProfileConfig.from(res.body.username), {});

        // Operational resources are retained under the anonymous identifier
        assert.equal((await models.Connection.from(connection.id)).username, res.body.username);

        await models.Connection.delete(connection.id);
        await models.Profile.delete(res.body.username);
    } finally {
        stub.restore();
        Sinon.restore();
    }
});

flight.landing();
