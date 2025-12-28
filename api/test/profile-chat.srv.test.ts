import test from 'node:test';
import assert from 'node:assert';
import ws from 'ws';
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
    const url = new URL(`ws://localhost:5001`);
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const conn = new ws(url);

    await new Promise<void>((resolve, reject) => {
        conn.on('open', async () => {
            try {
                // Wait 1 second
                await new Promise((resolve) => setTimeout(resolve, 1000));

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
                reject(err);
            }
        }).on('error', (err) => {
            reject(err);
        }).on('message', (data) => {
            try {
                const res = JSON.parse(String(data));

                assert.equal(res.type, 'chat');
                assert.equal(res.connection, 'admin@example.com');
                assert.equal(res.data.message, 'Wilco');
                assert.equal(res.data.from.callsign, 'user@example.com');

                conn.close();
                resolve();
            } catch (err) {
                reject(err);
            }
        })
    });
});

test('GET: api/profile/chatroom', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
             total: 1,
             items: [{
                id: 'user@example.com',
                chatroom: 'user@example.com'
             }],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
