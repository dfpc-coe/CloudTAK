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
            status: 'configured',
            id: 1,
            name: 'Default Server',
            url: 'ssl://ops.example.com:8089',
            auth: false,
            api: 'https://ops.example.com:8443',
            provider_url: '',
            provider_secret: '',
            provider_client: ''
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
            status: 'configured',
            id: 1,
            name: 'Default Server',
            url: 'ssl://ops.example.com:8089',
            auth: false,
            api: 'https://ops.example.com:8443',
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
