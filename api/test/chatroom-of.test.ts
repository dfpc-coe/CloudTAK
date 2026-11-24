import test from 'node:test';
import assert from 'node:assert';
import { CoTParser } from '@tak-ps/node-cot';
import { chatroomOf, chatMessageId, chatMembers } from '../stateful/lib/connection-pool.js';

const me = 'ANDROID-CloudTAK-admin@example.com';

async function chat(attrs: string, uid = 'GeoChat.ANDROID-alpha.conversation.4f1c2f6e-message'): Promise<Awaited<ReturnType<typeof CoTParser.to_geojson>>> {
    return await CoTParser.to_geojson(CoTParser.from_xml(`
        <event version="2.0" uid="${uid}" type="b-t-f" how="h-g-i-g-o" time="2026-01-01T00:00:00Z" start="2026-01-01T00:00:00Z" stale="2026-01-02T00:00:00Z">
            <point lat="0" lon="0" hae="0" ce="9999999" le="9999999"/>
            <detail>
                <__chat ${attrs} senderCallsign="Alpha">
                    <chatgrp uid0="ANDROID-alpha" uid1="${me}" id="${me}"/>
                </__chat>
                <remarks source="ANDROID-alpha">Hello</remarks>
            </detail>
        </event>
    `));
}

test('chatMessageId: falls back to the last segment of the Event UID', async () => {
    const explicit = await chat(`id="${me}" chatroom="Admin" messageId="explicit-id"`);
    assert.equal(chatMessageId(explicit), 'explicit-id');

    const implied = await chat(`id="${me}" chatroom="Admin"`);
    assert.equal(chatMessageId(implied), '4f1c2f6e-message');
    assert.equal(chatMessageId(await chat(`id="${me}" chatroom="Admin"`)), chatMessageId(implied));
});

test('chatroomOf: legacy broadcast rooms are All Chat Rooms', async () => {
    for (const legacy of ['All Streaming', 'Streaming', 'All Chat Rooms']) {
        const feat = await chat(`id="${legacy}" chatroom="${legacy}"`);
        assert.ok(feat.properties.chat);

        const room = chatroomOf(feat.properties.chat, me);
        assert.equal(room.id, 'All Chat Rooms');
        assert.equal(room.name, 'All Chat Rooms');
        assert.equal(room.type, 'group');
    }
});

test('chatroomOf: a chat addressed to the user is a Direct Chatroom keyed by the sender', async () => {
    const feat = await chat(`id="${me}" chatroom="Admin"`);
    assert.ok(feat.properties.chat);

    assert.deepEqual(chatroomOf(feat.properties.chat, me), { id: 'ANDROID-alpha', name: 'Alpha', type: 'direct' });
});

test('chatroomOf: a chat addressed to its own sender (TAK Aware) is a Direct Chatroom', async () => {
    const feat = await chat('id="ANDROID-alpha" chatroom="Alpha" parent="RootContactGroup"');
    assert.ok(feat.properties.chat);

    assert.deepEqual(chatroomOf(feat.properties.chat, me), { id: 'ANDROID-alpha', name: 'Alpha', type: 'direct' });
});

test('chatMembers: chatgrp members are kept when the hierarchy lists no contacts', async () => {
    const feat = await CoTParser.to_geojson(CoTParser.from_xml(`
        <event version="2.0" uid="GeoChat.ANDROID-alpha.group-1.message-1" type="b-t-f" how="h-g-i-g-o" time="2026-01-01T00:00:00Z" start="2026-01-01T00:00:00Z" stale="2026-01-02T00:00:00Z">
            <point lat="0" lon="0" hae="0" ce="9999999" le="9999999"/>
            <detail>
                <__chat id="group-1" chatroom="test" parent="UserGroups" groupOwner="true" messageId="message-1" senderCallsign="Alpha">
                    <chatgrp uid0="ANDROID-alpha" uid1="${me}" uid2="IOS-bravo" id="group-1"/>
                    <hierarchy>
                        <group uid="RootContactGroup" name="Contacts">
                            <group uid="UserGroups" name="Groups">
                                <group uid="group-1" name="test"/>
                            </group>
                        </group>
                    </hierarchy>
                </__chat>
                <remarks source="ANDROID-alpha">Hello</remarks>
            </detail>
        </event>
    `));

    assert.ok(feat.properties.chat);

    assert.deepEqual(chatMembers(feat.properties.chat, me), {
        listed: false,
        members: [
            { uid: 'ANDROID-alpha', callsign: 'Alpha' },
            { uid: 'IOS-bravo', callsign: 'IOS-bravo' },
        ],
    });
});
