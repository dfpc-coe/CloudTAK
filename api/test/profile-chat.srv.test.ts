import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/profile/chat', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/chat', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
             total: 0,
             items: [],
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
