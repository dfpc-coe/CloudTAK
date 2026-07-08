import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import ws from 'ws';
import Flight from './flight.js';
import { CoTParser } from '@tak-ps/node-cot';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const messageId = randomUUID();

// WinTAK style Chat Receipt - reuses the `__chat` detail element with no remarks
// and a `messageId` referencing the original message
function receipt(type: 'b-t-f-d' | 'b-t-f-r' | 'b-t-f-p' | 'b-t-f-s') {
    const time = new Date().toISOString();
    const stale = new Date(Date.now() + 60 * 1000).toISOString();

    return CoTParser.from_xml(`
        <event version="2.0" uid="${messageId}" type="${type}" how="h-g-i-g-o" time="${time}" start="${time}" stale="${stale}">
            <point lat="0.0" lon="0.0" hae="0.0" ce="9999999" le="9999999"/>
            <detail>
                <__chat id="ANDROID-CloudTAK-admin@example.com" chatroom="admin@example.com" senderCallsign="user@example.com" groupOwner="false" messageId="${messageId}">
                    <chatgrp id="ANDROID-CloudTAK-admin@example.com" uid0="ANDROID-user-device" uid1="ANDROID-CloudTAK-admin@example.com"/>
                </__chat>
                <link uid="ANDROID-user-device" type="a-f-G-U-C" relation="p-p"/>
            </detail>
        </event>
    `);
}

test('Streaming: Chat Receipts update Message Status', async () => {
    const url = new URL(flight.base.replace(/^http/, 'ws'));
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const conn = new ws(url);

    const receipts: Array<{ messageId: string; status: string; chatroom: string }> = [];

    await new Promise<void>((resolve, reject) => {
        conn.on('error', (err) => {
            reject(err);
        }).on('message', async (data) => {
            try {
                const res = JSON.parse(String(data));

                if (res.type === 'status') return;

                if (res.type === 'connected') {
                    conn.send(JSON.stringify({
                        type: 'chat',
                        data: {
                            chatroom: 'user@example.com',
                            from: {
                                uid: 'ANDROID-CloudTAK-admin@example.com',
                                callsign: 'admin@example.com',
                            },
                            to: {
                                uid: 'ANDROID-user-device',
                                callsign: 'user@example.com',
                            },
                            message: 'Receipt Test',
                            messageId,
                        },
                    }));
                    return;
                }

                if (res.type === 'Error') {
                    throw new Error(`WebSocket Error: ${JSON.stringify(res)}`);
                }

                assert.equal(res.type, 'chat:receipt');
                assert.equal(res.connection, 'admin@example.com');
                assert.equal(res.data.messageId, messageId);

                receipts.push(res.data);

                if (receipts.length === 1) {
                    // The server confirmed the outgoing message
                    assert.equal(res.data.status, 'sent');
                    flight.tak.write(receipt('b-t-f-d'));
                } else if (receipts.length === 2) {
                    // The recipient's client confirmed delivery
                    assert.equal(res.data.status, 'delivered');
                    flight.tak.write(receipt('b-t-f-r'));
                } else if (receipts.length === 3) {
                    // The recipient's client confirmed the message was read
                    assert.equal(res.data.status, 'read');

                    // A late delivery receipt must not downgrade the read status
                    flight.tak.write(receipt('b-t-f-d'));
                } else if (receipts.length === 4) {
                    assert.equal(res.data.status, 'delivered');

                    conn.close();
                    resolve();
                }
            } catch (err) {
                reject(err);
            }
        });
    });
});

test('GET: api/profile/chatroom/:chatroom/chat (Receipts must not overwrite the Message)', async () => {
    try {
        const res = await flight.fetch('/api/profile/chatroom/user%40example.com/chat', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].message_id, messageId);
        assert.equal(res.body.items[0].message, 'Receipt Test');
        assert.equal(res.body.items[0].status, 'read');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
