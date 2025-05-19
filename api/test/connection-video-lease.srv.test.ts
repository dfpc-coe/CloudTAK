import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

flight.connection();

test('GET: api/connection/1/video/lease', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1/video/lease', {
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

test('POST: api/connection/1/video/lease', async (t) => {
    try {
        const res = await flight.fetch('/api/connection/1/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'TEST Lease'
            }
        }, false);

        t.deepEquals(res.body, {
            status: 400,
            message: 'Media Integration is not configured',
            messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
