import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET api/config/display', async (t) => {
    try {
        const res = await flight.fetch('/api/config/display', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
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
             text: {
                 value: 'Medium',
                 options: [ 'Small', 'Medium', 'Large' ]
             }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PUT api/config', async (t) => {

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
            }
        }, false);

        t.deepEquals(res.body, {
            'display::stale': '30 Minutes',
            'display::distance': 'kilometer',
            'display::elevation': 'meter'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.user({
    username: 'defaults',
    admin: false
});

test('GET api/profile', async (t) => {
    try {
        const res = await flight.fetch('/api/profile', {
            method: 'GET',
            auth: {
                bearer: flight.token.defaults
            },
        }, true);

        t.equals(res.body.display_stale, '30 Minutes', 'default stale value');
        t.equals(res.body.display_distance, 'kilometer', 'default distance value');
        t.equals(res.body.display_elevation, 'meter', 'default elevation value');
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
