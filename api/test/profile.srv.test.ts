import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
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
            display_style: 'System Default',
            display_coordinate: 'dd',
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
            display_style: 'System Default',
            display_coordinate: 'dd',
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
                'display::style': 'Dark',
                'display::coordinate': 'mgrs',
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

        assert.ok(res.body.last_login);
        delete res.body.last_login;
        assert.ok(res.body.created);
        delete res.body.created;
        assert.ok(res.body.updated);
        delete res.body.updated;

        assert.deepEqual(res.body, {
            active: false,
            username: 'configtest@example.com',
            phone: '',
            tak_callsign: 'CloudTAK User',
            tak_remarks: 'CloudTAK User',
            tak_group: 'Orange',
            tak_role: 'Team Member',
            tak_type: 'a-f-G-E-V-C',
            tak_loc: null,
            tak_loc_freq: 2000,
            menu_order: [],
            display_stale: 'Immediate',
            display_distance: 'meter',
            display_elevation: 'meter',
            display_speed: 'm/s',
            display_projection: 'mercator',
            display_zoom: 'always',
            display_style: 'Dark',
            display_coordinate: 'mgrs',
            display_text: 'Large',
            display_icon_rotation: false,
            system_admin: false,
            agency_admin: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
