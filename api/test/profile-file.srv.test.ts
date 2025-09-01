import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/profile/asset', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/asset', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
             total: 0,
             tiles: {
                 url: 'http://localhost:5001/tiles/profile/admin@example.com/'
             },
             items: [],
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
