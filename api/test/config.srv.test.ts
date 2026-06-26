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
                bearer: flight.token.admin,
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
                bearer: flight.token.admin,
            },
            body: {
                'group::Yellow': 'Wildland Firefighter',
            },
        }, false);

        assert.deepEqual(res.body, {
            'group::Yellow': 'Wildland Firefighter',
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
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            'group::Yellow': 'Wildland Firefighter',
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
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            name: 'CloudTAK',
            username: 'Username or Email',
            brand: {
                enabled: 'default',
            },
            background: {
                enabled: false,
            },
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
                bearer: flight.token.admin,
            },
            body: {
                'login::signup': 'https://example.com/signup',
                'login::forgot': 'https://example.com/forgot',
            },
        }, false);

        assert.deepEqual(res.body, {
            'login::signup': 'https://example.com/signup',
            'login::forgot': 'https://example.com/forgot',
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
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            name: 'CloudTAK',
            signup: 'https://example.com/signup',
            forgot: 'https://example.com/forgot',
            username: 'Username or Email',
            brand: {
                enabled: 'default',
            },
            background: {
                enabled: false,
            },
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
                bearer: flight.token.user,
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
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            'map::center': '-100,40',
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
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            'group::Yellow': 'Wildland Firefighter',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT api/config (admin - push firebase keys)', async () => {
    try {
        const body = {
            'notification::push::firebase::project_id': 'cloudtak-project',
            'notification::push::firebase::client_email': 'firebase-adminsdk@cloudtak-project.iam.gserviceaccount.com',
            'notification::push::firebase::private_key': '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        };

        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body,
        }, false);

        assert.deepEqual(res.body, body);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config (admin - push firebase keys)', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=notification::push::firebase::project_id,notification::push::firebase::client_email,notification::push::firebase::private_key', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            'notification::push::firebase::project_id': 'cloudtak-project',
            'notification::push::firebase::client_email': 'firebase-adminsdk@cloudtak-project.iam.gserviceaccount.com',
            'notification::push::firebase::private_key': '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config (user - push firebase private_key restricted)', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=notification::push::firebase::private_key', {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET api/config (user - push firebase service-account identifiers restricted)', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=notification::push::firebase::project_id,notification::push::firebase::client_email', {
            method: 'GET',
            auth: {
                bearer: flight.token.user,
            },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
