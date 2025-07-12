import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET api/config', async (t) => {
    try {
        const res = await flight.fetch('/api/config?keys=group::Yellow', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {});
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
                'group::Yellow': 'Wildland Firefighter'
            }
        }, false);

        t.deepEquals(res.body, {
            'group::Yellow': 'Wildland Firefighter'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config', async (t) => {
    try {
        const res = await flight.fetch('/api/config?keys=group::Yellow', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            'group::Yellow': 'Wildland Firefighter'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/group', async (t) => {
    try {
        const res = await flight.fetch('/api/config/group', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            roles: [ 'Team Member', 'Team Lead', 'HQ', 'Sniper', 'Medic', 'Forward Observer', 'RTO', 'K9' ],
            groups: { Yellow: 'Wildland Firefighter', Cyan: '', Green: '', Red: '', Purple: '', Orange: '', Blue: '', Magenta: '', White: '', Maroon: '', 'Dark Blue': '', Teal: '', 'Dark Green': '', Brown: '' }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/login', async (t) => {
    try {
        const res = await flight.fetch('/api/config/login', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {});
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
                'login::signup': 'https://example.com/signup',
                'login::forgot': 'https://example.com/forgot'
            }
        }, false);

        t.deepEquals(res.body, {
            'login::signup': 'https://example.com/signup',
            'login::forgot': 'https://example.com/forgot'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/login', async (t) => {
    try {
        const res = await flight.fetch('/api/config/login', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            'signup': 'https://example.com/signup',
            'forgot': 'https://example.com/forgot'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/map', async (t) => {
    try {
        const res = await flight.fetch('/api/config/map', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            center: '-100,40',
            zoom: 4,
            pitch: 0,
            bearing: 0
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET api/config/display', async (t) => {
    try {
        const res = await flight.fetch('/api/config/display', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        console.error(JSON.stringify(res.body));

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

flight.landing();
