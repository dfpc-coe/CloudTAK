import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/profile/overlay', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
             removed: [],
             total: 0,
             items: [],
             available: {
                 terrain: false
             }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
