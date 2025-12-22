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

flight.landing();
