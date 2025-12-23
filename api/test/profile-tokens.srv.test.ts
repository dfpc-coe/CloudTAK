import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();

flight.user({ username: 'first' });
flight.user({ username: 'second' });

test('GET: api/profile/token', async () => {
    try {
        const res = await flight.fetch('/api/profile/token', {
            method: 'GET',
            auth: {
                bearer: flight.token.first
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/token', async () => {
    try {
        const res = await flight.fetch('/api/profile/token', {
            method: 'POST',
            auth: {
                bearer: flight.token.first
            },
            body: {
                name: 'Test Token'
            }
        }, true);

        const token = res.body.token;
        assert.ok(res.body.token);
        delete res.body.token;

        assert.ok(res.body.created);
        delete res.body.created;

        assert.ok(res.body.updated);
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            username: 'first@example.com',
            name: 'Test Token'
        });

        // List features of user just to test the token
        const features = await flight.fetch('/api/profile/feature', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, true);

        assert.deepEqual(features.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/token - Ensure ACL is respected', async () => {
    try {
        const res = await flight.fetch('/api/profile/token', {
            method: 'GET',
            auth: {
                bearer: flight.token.second
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/token', async () => {
    try {
        const res = await flight.fetch('/api/profile/token', {
            method: 'GET',
            auth: {
                bearer: flight.token.first
            }
        }, true);

        assert.ok(res.body.items[0].created);
        delete res.body.items[0].created;

        assert.ok(res.body.items[0].updated);
        delete res.body.items[0].updated;

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                id: 1,
                username: 'first@example.com',
                name: 'Test Token'
            }]
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/profile/token/1 - Ensure ACL is respected', async () => {
    try {
        const res = await flight.fetch('/api/profile/token/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.second
            },
            body: {
                name: 'Test Token Rename'
            }
        }, false);

        assert.deepEqual(res.body, {
            status: 403,
            message: 'You can only modify your own tokens',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});


test('PATCH: api/profile/token/1', async () => {
    try {
        const res = await flight.fetch('/api/profile/token/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.first
            },
            body: {
                name: 'Test Token Rename'
            }
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Token Updated'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/profile/token/1 - Ensure ACL is respected', async () => {
    try {
        const res = await flight.fetch('/api/profile/token/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.second
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 403,
            message: 'You can only modify your own tokens',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/profile/token/1', async () => {
    try {
        const res = await flight.fetch('/api/profile/token/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.first
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Token Deleted'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
