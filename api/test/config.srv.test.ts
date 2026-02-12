import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ admin: false });

test('GET api/config', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=group::Yellow', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {});
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
                'group::Yellow': 'Wildland Firefighter'
            }
        }, false);

        assert.deepEqual(res.body, {
            'group::Yellow': 'Wildland Firefighter'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=group::Yellow', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            'group::Yellow': 'Wildland Firefighter'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config/group', async () => {
    try {
        const res = await flight.fetch('/api/config/group', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            roles: [ 'Team Member', 'Team Lead', 'HQ', 'Sniper', 'Medic', 'Forward Observer', 'RTO', 'K9' ],
            groups: { Yellow: 'Wildland Firefighter', Cyan: '', Green: '', Red: '', Purple: '', Orange: '', Blue: '', Magenta: '', White: '', Maroon: '', 'Dark Blue': '', Teal: '', 'Dark Green': '', Brown: '' }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config/login', async () => {
    try {
        const res = await flight.fetch('/api/config/login', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            name: 'CloudTAK',
            username: 'Username or Email',
            brand: {
                enabled: 'default'
            },
            background: {
                enabled: false
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
                'login::signup': 'https://example.com/signup',
                'login::forgot': 'https://example.com/forgot'
            }
        }, false);

        assert.deepEqual(res.body, {
            'login::signup': 'https://example.com/signup',
            'login::forgot': 'https://example.com/forgot'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config/login', async () => {
    try {
        const res = await flight.fetch('/api/config/login', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            name: 'CloudTAK',
            signup: 'https://example.com/signup',
            forgot: 'https://example.com/forgot',
            username: 'Username or Email',
            brand: {
                enabled: 'default'
            },
            background: {
                enabled: false
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config/map', async () => {
    try {
        const res = await flight.fetch('/api/config/map', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            center: '-100,40',
            zoom: 4,
            pitch: 0,
            bearing: 0,
            basemap: null,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config (user - restricted)', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=agol::token', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config (user - map keys)', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=map::center', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            },
        }, false);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            'map::center': '-100,40'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config (user - group keys)', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=group::Yellow', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            },
        }, false);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            'group::Yellow': 'Wildland Firefighter'
        });
    } catch (err) {
        assert.ifError(err);
    }
});


flight.landing();
