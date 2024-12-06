import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();
flight.user({ admin: false });

test('GET: api/server - Admin', async (t) => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        delete res.body.created;
        delete res.body.updated;

        t.deepEquals(res.body, {
            id: 1,
            status: 'unconfigured',
            name: 'Default Server',
            url: '',
            api: '',
            webtak: '',
            auth: false
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/server - User', async (t) => {
    try {
        const res = await flight.fetch('/api/server', {
            method: 'GET',
            auth: {
                bearer: flight.token.user
            }
        }, true);

        delete res.body.created;
        delete res.body.updated;

        t.deepEquals(res.body, {
            id: 1,
            status: 'unconfigured',
            name: 'Default Server',
            url: '',
            api: '',
            webtak: '',
            auth: false
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
