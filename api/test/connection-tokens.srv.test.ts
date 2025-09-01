import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

flight.connection();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()
let token: string;

test('GET: api/connection/1/token', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1/token', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
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

test('POST: api/connection/1/token', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1/token', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Token',
            }
        }, true);


        t.ok(res.body.created, 'has created');
        res.body.created = time

        t.ok(res.body.created, 'has updated');
        res.body.updated = time

        t.ok(res.body.token, 'has token');
        t.ok(res.body.token.startsWith('etl.ey'), 'valid token');

        token = res.body.token;
        res.body.token = 'etl.123'

        t.deepEquals(res.body, {
            id: 1,
            connection: 1,
            name: 'Test Token',
            token: 'etl.123',
            created: time,
            updated: time
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/connection/1 - Use Token', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, true);

        t.ok(res.body.created, 'has created');
        res.body.created = time

        t.ok(res.body.created, 'has updated');
        res.body.updated = time

        t.ok(res.body.certificate.validFrom, 'has certificate.validFrom');
        res.body.certificate.validFrom = time

        t.ok(res.body.certificate.validTo, 'has certificate.validTo');
        res.body.certificate.validTo = time

        t.deepEquals(res.body, {
            status: 'dead',
            certificate: {
                validFrom: time,
                validTo: time,
                subject: 'CN=Alice'
            },
            id: 1,
            readonly: false,
            agency: null,
            created: time,
            updated: time,
            username: 'admin@example.com',
            name: 'Test Connection',
            description: 'Connection created by Flight Test Runner',
            enabled: true
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PATCH: api/connection/1/token/1', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1/token/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'New Token Name'
            }
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Connection Token Updated',
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/connection/1/token/1', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1/token/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Connection Token Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/connection/1 - Use Token, Access Revoked', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, false);

        t.deepEquals(res.body, {
            status: 403,
            message: 'Token does not exist',
            messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
