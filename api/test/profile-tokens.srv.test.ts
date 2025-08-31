import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();

flight.user({ username: 'first' });
flight.user({ username: 'second' });

test('GET: api/profile/token', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/token', {
            method: 'GET',
            auth: {
                bearer: flight.token.first
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/profile/token', async (t) => {
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
        t.ok(res.body.token);
        delete res.body.token;

        t.ok(res.body.created);
        delete res.body.created;

        t.ok(res.body.updated);
        delete res.body.updated;

        t.deepEquals(res.body, {
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

        t.deepEquals(features.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }
    t.end();
});

test('GET: api/profile/token - Ensure ACL is respected', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/token', {
            method: 'GET',
            auth: {
                bearer: flight.token.second
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/token', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/token', {
            method: 'GET',
            auth: {
                bearer: flight.token.first
            }
        }, true);

        t.ok(res.body.items[0].created);
        delete res.body.items[0].created;

        t.ok(res.body.items[0].updated);
        delete res.body.items[0].updated;

        t.deepEquals(res.body, {
            total: 1,
            items: [{
                id: 1,
                username: 'first@example.com',
                name: 'Test Token'
            }]
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PATCH: api/profile/token/1 - Ensure ACL is respected', async (t) => {
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

        t.deepEquals(res.body, {
            status: 403,
            message: 'You can only modify your own tokens',
            messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});


test('PATCH: api/profile/token/1', async (t) => {
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

        t.deepEquals(res.body, {
            status: 200,
            message: 'Token Updated'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/profile/token/1 - Ensure ACL is respected', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/token/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.second
            },
        }, false);

        t.deepEquals(res.body, {
            status: 403,
            message: 'You can only modify your own tokens',
            messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/profile/token/1', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/token/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.first
            },
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Token Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
