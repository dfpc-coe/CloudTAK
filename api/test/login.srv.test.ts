import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('POST: api/login', async (t) => {
    try {
        const res = await flight.fetch('/api/login', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                username: 'admin@example.com',
                password: 'password123'
            }
        }, false);

        t.deepEquals(res.body, {
            status: 400,
            message: 'Server has not been configured',
            messages: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.server('admin@example.com', 'password123');

test('POST: api/login', async (t) => {
    try {
        const res = await flight.fetch('/api/login', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                username: 'admin@example.com',
                password: 'password123'
            }
        }, false);
        
        t.ok(res.body.token);
        delete res.body.token;

        t.deepEquals(res.body, {
            access: 'admin',
            email: 'admin@example.com',
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
