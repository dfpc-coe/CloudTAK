import test from 'node:test';
import assert from 'node:assert';
import ws from 'ws';
import Flight from './flight.js';
import { DirectChat } from '@tak-ps/node-cot'

const flight = new Flight();

flight.init({ takserver: true });
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
        conn.on('error', (err) => {
            reject(err);
        }).on('message', async (data) => {
            try {
                const res = JSON.parse(String(data));

                if (res.type === 'connected') {
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
                    return;
                }

                if (res.type === 'status') return;

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

        assert.ok(res.body.items[0].updated);
        delete res.body.items[0].updated;

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
