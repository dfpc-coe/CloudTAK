import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { DirectChat } from '@tak-ps/node-cot'

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/profile/chatroom', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
             total: 0,
             items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('Streaming: TAK Chat Message', async () => {
    try {
        const chat = new DirectChat({
            to: {
                uid: 'ANDROID-CloudTAK-admin@example.com',
                callsign: 'admin@example.com'
            },
            from: {
                uid: 'ANDROID-CloudTAK-user@example.com',
                callsign: 'user@example.com'
            },
            message: 'Wilco',
        });

        flight.tak.write(chat);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
