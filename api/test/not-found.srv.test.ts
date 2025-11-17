import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/fake/path/to/resource', async (t) => {
    try {
        const res = await flight.fetch('/api/fake/path/to/resource', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.deepEquals(res.body, {
            status: 404,
            message: 'API endpoint does not exist!',
            messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
