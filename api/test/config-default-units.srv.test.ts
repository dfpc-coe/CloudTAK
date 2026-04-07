import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET api/config/display', async () => {
    try {
        const res = await flight.fetch('/api/config/display', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
             stale: {
                value: '10 Minutes',
                options: [ 'Immediate', '10 Minutes', '30 Minutes', '1 Hour', 'Never' ]
             },
             distance: {
                 value: 'mile',
                 options: [ 'meter', 'kilometer', 'mile' ]
             },
             elevation: {
                 value: 'feet',
                 options: [ 'meter', 'feet' ]
             },
             speed: {
                 value: 'mi/h',
                 options: [ 'm/s', 'km/h', 'mi/h' ]
             },
             projection: {
                 value: 'globe',
                 options: [ 'mercator', 'globe' ]
             },
             zoom: {
                 value: 'conditional',
                 options: [ 'always', 'conditional', 'never' ]
             },
             style: {
                 value: 'System Default',
                 options: [ 'System Default', 'Light', 'Dark' ]
             },
             coordinate: {
                 value: 'dd',
                 options: [ 'dd', 'dm', 'dms', 'mgrs', 'utm' ]
             },
             text: {
                 value: 'Medium',
                 options: [ 'Small', 'Medium', 'Large' ]
             },
             icon_rotation: {
                 value: true,
                 options: [ true, false ]
             }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT api/config', async () => {

    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'display::stale': '30 Minutes',
                'display::distance': 'kilometer',
                'display::elevation': 'meter',
                'display::style': 'Light',
                'display::icon_rotation': false
            }
        }, false);

        assert.deepEqual(res.body, {
            'display::stale': '30 Minutes',
            'display::distance': 'kilometer',
            'display::elevation': 'meter',
            'display::style': 'Light',
            'display::icon_rotation': false
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config/display - icon_rotation false conversion', async () => {
    try {
        const res = await flight.fetch('/api/config/display', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.equal(res.body.icon_rotation.value, false, 'string "false" converted to boolean false');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT api/config - reset icon_rotation to true', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'display::icon_rotation': true
            }
        }, false);

        assert.deepEqual(res.body, {
            'display::icon_rotation': true
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config/display - icon_rotation true conversion', async () => {
    try {
        const res = await flight.fetch('/api/config/display', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.equal(res.body.icon_rotation.value, true, 'string "true" converted to boolean true');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.user({
    username: 'defaults',
    admin: false
});

test('GET api/profile', async () => {
    try {
        const res = await flight.fetch('/api/profile', {
            method: 'GET',
            auth: {
                bearer: flight.token.defaults
            },
        }, true);

        assert.ok(res.body.last_login);
        delete res.body.last_login;
        assert.ok(res.body.created);
        delete res.body.created;
        assert.ok(res.body.updated);
        delete res.body.updated;

        assert.deepEqual(res.body, {
            active: false,
            username: 'defaults@example.com',
            phone: '',
            tak_callsign: 'CloudTAK User',
            tak_remarks: 'CloudTAK User',
            tak_group: 'Orange',
            tak_role: 'Team Member',
            tak_type: 'a-f-G-E-V-C',
            tak_loc: null,
            tak_loc_freq: 2000,
            menu_order: [],
            display_stale: '30 Minutes',
            display_distance: 'kilometer',
            display_elevation: 'meter',
            display_speed: 'mi/h',
            display_projection: 'globe',
            display_zoom: 'conditional',
            display_style: 'Light',
            display_coordinate: 'dd',
            display_text: 'Medium',
            display_icon_rotation: true,
            system_admin: false,
            agency_admin: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
