import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('POST: api/login', async () => {
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

        assert.deepEqual(res.body, {
            status: 400,
            message: 'Server has not been configured',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.server('admin@example.com', 'password123');

test('POST: api/login', async () => {
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
        
        assert.ok(res.body.token);
        delete res.body.token;

        assert.deepEqual(res.body, {
            access: 'admin',
            email: 'admin@example.com',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
