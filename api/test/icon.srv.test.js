import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init(test);
flight.takeoff(test);
flight.user(test);

test('GET: api/icon', async (t) => {
    try {
        const res = await flight.fetch('/api/icon', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.equals(res.body.total, 3268);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/icon/f-A-W', async (t) => {
    try {
        const res = await flight.fetch('/api/icon/f-A-W', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            id: 'f-A-W',
            name: 'Friendly Weapon',
            file: 'sfapw----------.png',
            parent: 'f-A',
            children: [ 'f-A-W-B', 'f-A-W-D', 'f-A-W-M' ]
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing(test);
