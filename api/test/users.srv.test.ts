import test from 'node:test';
import assert from 'node:assert';
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

flight.landing();
