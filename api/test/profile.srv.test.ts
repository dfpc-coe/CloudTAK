import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/profile', async () => {
    try {
        const res = await flight.fetch('/api/profile', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.ok(res.body.last_login);
        delete res.body.last_login;
        assert.ok(res.body.created);
        delete res.body.created;
        assert.ok(res.body.updated);
        delete res.body.updated;

        assert.deepEqual(res.body, {
            active: false,
            username: 'admin@example.com',
            phone: '',
            tak_callsign: 'CloudTAK User',
            tak_remarks: 'CloudTAK User',
            tak_group: 'Orange',
            tak_role: 'Team Member',
            tak_type: 'a-f-G-E-V-C',
            tak_loc: null,
            tak_loc_freq: 2000,
            menu_order: [],
            display_stale: '10 Minutes',
            display_distance: 'mile',
            display_elevation: 'feet',
            display_speed: 'mi/h',
            display_projection: 'globe',
            display_zoom: 'conditional',
            display_icon_rotation: true,
            display_text: 'Medium',
            system_admin: true,
            agency_admin: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/profile', async () => {
    try {
        const res = await flight.fetch('/api/profile', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                tak_callsign: 'Test Callsign'
            }
        }, true);

        assert.ok(res.body.last_login);
        delete res.body.last_login;
        assert.ok(res.body.created);
        delete res.body.created;
        assert.ok(res.body.updated);
        delete res.body.updated;

        assert.deepEqual(res.body, {
            active: false,
            username: 'admin@example.com',
            phone: '',
            tak_callsign: 'Test Callsign',
            tak_remarks: 'CloudTAK User',
            tak_group: 'Orange',
            tak_role: 'Team Member',
            tak_type: 'a-f-G-E-V-C',
            tak_loc: null,
            tak_loc_freq: 2000,
            menu_order: [],
            display_stale: '10 Minutes',
            display_distance: 'mile',
            display_elevation: 'feet',
            display_speed: 'mi/h',
            display_projection: 'globe',
            display_zoom: 'conditional',
            display_text: 'Medium',
            display_icon_rotation: true,
            system_admin: true,
            agency_admin: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/config - Change Defaults', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'display::stale': 'Immediate',
                'display::distance': 'meter',
                'display::elevation': 'meter',
                'display::speed': 'm/s',
                'display::projection': 'mercator',
                'display::zoom': 'always',
                'display::text': 'Large',
                'display::icon_rotation': false,
            }
        }, true);

        assert.ok(res.body['display::stale']);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.user({ username: 'configtest', admin: false });

test('GET: api/profile - New User / New Defaults', async () => {
    try {
        const res = await flight.fetch('/api/profile', {
            method: 'GET',
            auth: {
                bearer: flight.token.configtest
            }
        }, true);

        assert.deepEqual(res.body.display_stale, 'Immediate');
        assert.deepEqual(res.body.display_distance, 'meter');
        assert.deepEqual(res.body.display_elevation, 'meter');
        assert.deepEqual(res.body.display_speed, 'm/s');
        assert.deepEqual(res.body.display_projection, 'mercator');
        assert.deepEqual(res.body.display_zoom, 'always');
        assert.deepEqual(res.body.display_text, 'Large');
        assert.deepEqual(res.body.display_icon_rotation, false);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
