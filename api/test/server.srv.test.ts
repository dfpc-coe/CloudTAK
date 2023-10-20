import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/server - unconfigured', async (t) => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            status: 'unconfigured'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/server', async (t) => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Default Server',
                url: 'ssl://example.com'
            }
        }, true);

        for (const key of ['created', 'updated']) {
            t.ok(res.body[key], `.${key}`);
            delete res.body[key];
        }

        t.deepEquals(res.body, {
            id: 1,
            status: 'configured',
            name: 'Default Server',
            url: 'ssl://example.com',
            api: ''
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/server', async (t) => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        for (const key of ['created', 'updated']) {
            t.ok(res.body[key], `.${key}`);
            delete res.body[key];
        }

        t.deepEquals(res.body, {
            id: 1,
            status: 'configured',
            name: 'Default Server',
            url: 'ssl://example.com',
            api: ''
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
