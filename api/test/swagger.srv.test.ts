import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/swagger', async (t) => {
    try {
        const res = await flight.fetch('/api/swagger', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.ok(res.body.info)
        t.equals(res.body.info.title, 'CloudTAK API');
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
