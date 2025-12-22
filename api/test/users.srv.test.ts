import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()

test('GET: api/user', async () => {
    try {
        const res = await flight.fetch('/api/user', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        res.body.items.forEach((i: {
            last_login: string;
            created: string;
            updated: string;
        }) => {
            i.last_login = time;
            i.created = time;
            i.updated = time;
        })

        assert.deepEqual(res.body, {
             total: 1,
             items: [{
                 active: false,
                 username: 'admin@example.com',
                 last_login: time,
                 created: time,
                 updated: time,
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
                 display_icon_rotation: true,
                 display_projection: 'globe',
                 display_zoom: 'conditional',
                 display_text: 'Medium',
                 system_admin: true,
                 agency_admin: []
             }]
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/user/admin@example.com', async () => {
    try {
        const res = await flight.fetch('/api/user/admin@example.com', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                 tak_callsign: 'New Callsign',
            }
        }, true);

        res.body.last_login = time;
        res.body.created = time;
        res.body.updated = time;

        assert.deepEqual(res.body, {
             active: false,
             username: 'admin@example.com',
             last_login: time,
             created: time,
             updated: time,
             phone: '',
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
             display_icon_rotation: true,
             display_zoom: 'conditional',
             display_text: 'Medium',
             system_admin: true,
             agency_admin: []
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
                bearer: flight.token.admin
            },
        }, true);

        res.body.last_login = time;
        res.body.created = time;
        res.body.updated = time;

        assert.deepEqual(res.body, {
             active: false,
             username: 'admin@example.com',
             last_login: time,
             created: time,
             updated: time,
             phone: '',
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
             display_icon_rotation: true,
             display_zoom: 'conditional',
             display_text: 'Medium',
             system_admin: true,
             agency_admin: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
