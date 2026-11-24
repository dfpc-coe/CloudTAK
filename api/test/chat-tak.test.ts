import test from 'node:test';
import assert from 'node:assert';
import { CoTParser } from '@tak-ps/node-cot';
import { chatSender, chatRoom, chatMembers, chatMessageId } from '../common/chat/tak.js';

const me = 'ANDROID-CloudTAK-admin@example.com';

async function chat(opts: {
    attrs: string;
    uid?: string;
    chatgrp?: string;
    source?: string;
    inner?: string;
}): Promise<Awaited<ReturnType<typeof CoTParser.to_geojson>>> {
    return await CoTParser.to_geojson(CoTParser.from_xml(`
        <event version="2.0" uid="${opts.uid ?? 'GeoChat.ANDROID-alpha.conversation.4f1c2f6e-message'}" type="b-t-f" how="h-g-i-g-o" time="2026-01-01T00:00:00Z" start="2026-01-01T00:00:00Z" stale="2026-01-02T00:00:00Z">
            <point lat="0" lon="0" hae="0" ce="9999999" le="9999999"/>
            <detail>
                <__chat ${opts.attrs} senderCallsign="Alpha">
                    <chatgrp ${opts.chatgrp ?? `uid0="ANDROID-alpha" uid1="${me}" id="${me}"`}/>
                    ${opts.inner ?? ''}
                </__chat>
                <remarks source="${opts.source ?? 'ANDROID-alpha'}">Hello</remarks>
            </detail>
        </event>
    `));
}

const alpha = { uid: 'ANDROID-alpha', callsign: 'Alpha' };

test('chatMessageId: falls back to the last segment of the Event UID', async () => {
    assert.equal(chatMessageId(await chat({ attrs: `id="${me}" chatroom="Admin" messageId="explicit-id"` })), 'explicit-id');
    assert.equal(chatMessageId(await chat({ attrs: `id="${me}" chatroom="Admin"` })), '4f1c2f6e-message');
});

test('chatSender: remarks source wins, with any client prefix removed', async () => {
    const feat = await chat({ attrs: `id="${me}" chatroom="Admin"` });

    assert.deepEqual(chatSender(feat, 'ANDROID-alpha'), alpha);
    assert.deepEqual(chatSender(feat, 'BAO.F.ATAK.ANDROID-alpha'), alpha);
    assert.deepEqual(chatSender(feat, 'BAO.F.TAKAware.first.last@example.com'), { uid: 'first.last@example.com', callsign: 'Alpha' });
});

test('chatSender: a dotted UID is recovered from the Event UID', async () => {
    const feat = await chat({
        uid: 'GeoChat.ANDROID-CloudTAK-first.last@example.com.group-1.message-1',
        attrs: 'id="group-1" chatroom="test" messageId="message-1" parent="UserGroups"',
    });

    assert.equal(chatSender(feat).uid, 'ANDROID-CloudTAK-first.last@example.com');
});

test('chatSender: chatgrp uid0 is only a last resort', async () => {
    const feat = await chat({
        uid: 'message-1',
        attrs: 'id="group-1" chatroom="test" messageId="message-1" parent="UserGroups"',
        chatgrp: 'uid0="ANDROID-creator" uid1="ANDROID-alpha" id="group-1"',
    });

    assert.equal(chatSender(feat, 'ANDROID-alpha').uid, 'ANDROID-alpha');
    assert.equal(chatSender(feat).uid, 'ANDROID-creator');
});

test('chatRoom: broadcast rooms, including the legacy names', async () => {
    for (const legacy of ['All Streaming', 'Streaming', 'All Chat Rooms']) {
        const feat = await chat({ attrs: `id="${legacy}" chatroom="${legacy}"` });
        assert.ok(feat.properties.chat);
        assert.deepEqual(chatRoom(feat.properties.chat, alpha, me), { type: 'broadcast' });
    }
});

test('chatRoom: a chat addressed to the user (ATAK) or to its own sender (TAK Aware) is direct', async () => {
    const atak = await chat({ attrs: `id="${me}" chatroom="Admin" parent="RootContactGroup"` });
    assert.ok(atak.properties.chat);
    assert.deepEqual(chatRoom(atak.properties.chat, alpha, me), { type: 'direct', peer: alpha });

    const aware = await chat({ attrs: 'id="ANDROID-alpha" chatroom="Alpha" parent="RootContactGroup"' });
    assert.ok(aware.properties.chat);
    assert.deepEqual(chatRoom(aware.properties.chat, alpha, me), { type: 'direct', peer: alpha });
});

test('chatRoom: the echo of a chat the user sent is direct with the recipient', async () => {
    const feat = await chat({
        attrs: 'id="ANDROID-alpha" chatroom="Alpha" parent="RootContactGroup"',
        chatgrp: `uid0="${me}" uid1="ANDROID-alpha" id="ANDROID-alpha"`,
    });

    assert.ok(feat.properties.chat);
    assert.deepEqual(chatRoom(feat.properties.chat, { uid: me, callsign: 'Admin' }, me), { type: 'direct', peer: alpha });
});

test('chatRoom & chatMembers: a Group keeps chatgrp members when its hierarchy lists no contacts', async () => {
    const feat = await chat({
        attrs: 'id="group-1" chatroom="test" parent="UserGroups" groupOwner="true"',
        chatgrp: `uid0="ANDROID-alpha" uid1="${me}" uid2="IOS-bravo" id="group-1"`,
        inner: `
            <hierarchy>
                <group uid="RootContactGroup" name="Contacts">
                    <group uid="UserGroups" name="Groups">
                        <group uid="group-1" name="test"/>
                    </group>
                </group>
            </hierarchy>
        `,
    });

    assert.ok(feat.properties.chat);
    assert.deepEqual(chatRoom(feat.properties.chat, alpha, me), { type: 'group', id: 'group-1', name: 'test', parent: 'UserGroups' });

    assert.deepEqual(chatMembers(feat.properties.chat, alpha), {
        listed: false,
        members: [
            alpha,
            { uid: me, callsign: me },
            { uid: 'IOS-bravo', callsign: 'IOS-bravo' },
        ],
    });
});
