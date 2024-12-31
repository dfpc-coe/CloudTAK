import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/connection', async (t) => {
    try {
        const res = await flight.fetch('/api/connection', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: [],
            status: {
                dead: 0,
                live: 0,
                unknown: 0
            }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/connection/1', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.deepEquals(res.body, {
            status: 404,
            message: 'Item Not Found',
            messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

//flight.connection();

flight.landing();
