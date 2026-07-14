import test from 'node:test';
import assert from 'node:assert';
import { CoTParser, DirectChat, FileShare } from '@tak-ps/node-cot';

test('Hub CoT round trip: DirectChat', async () => {
    const chat = new DirectChat({
        to: {
            uid: 'ANDROID-CloudTAK-friend@example.com',
            callsign: 'FRIEND',
        },
        from: {
            uid: 'ANDROID-CloudTAK-admin@example.com',
            callsign: 'ADMIN',
        },
        chatroom: 'FRIEND',
        message: 'Direct message with unicode ✓ & <entities>',
    });

    const restored = CoTParser.from_xml(CoTParser.to_xml(chat));

    assert.equal(restored.type(), chat.type());
    assert.equal(restored.uid(), chat.uid());

    const before = await CoTParser.to_geojson(chat);
    const after = await CoTParser.to_geojson(restored);

    assert.deepEqual(after.properties.chat, before.properties.chat);
    assert.equal(after.properties.remarks, before.properties.remarks);
});

test('Hub CoT round trip: FileShare', async () => {
    const share = new FileShare({
        filename: 'package.zip',
        name: 'package.zip',
        senderCallsign: 'CloudTAK User',
        senderUid: 'ANDROID-CloudTAK-admin@example.com',
        senderUrl: 'https://1.2.3.4:8443/Marti/sync/content?hash=abc123',
        sha256: 'abc123',
        sizeInBytes: 1234,
    });

    if (!share.raw.event.detail) share.raw.event.detail = {};
    share.raw.event.detail.marti = {
        dest: [{ _attributes: { uid: 'ANDROID-other', mission: undefined } }],
    };

    const restored = CoTParser.from_xml(CoTParser.to_xml(share));

    assert.equal(restored.type(), share.type());
    assert.ok(restored.raw.event.detail?.fileshare);
    assert.equal(restored.raw.event.detail?.fileshare?._attributes?.sha256, 'abc123');
    assert.equal(restored.raw.event.detail?.fileshare?._attributes?.sizeInBytes, 1234);
});

test('Hub CoT round trip: path & metadata sidecar', async () => {
    const cot = await CoTParser.from_geojson({
        id: 'sidecar-feature',
        type: 'Feature',
        path: '/Missions/Alpha/',
        properties: {
            callsign: 'SIDECAR',
            type: 'a-f-G',
            how: 'm-g',
            metadata: { source: 'etl-test', priority: 7 },
        },
        geometry: {
            type: 'Point',
            coordinates: [-105.1, 39.9],
        },
    });

    const wire = {
        xml: CoTParser.to_xml(cot),
        path: cot.path,
        metadata: cot.metadata,
    };

    const restored = CoTParser.from_xml(wire.xml);
    restored.path = wire.path;
    restored.metadata = wire.metadata;

    const after = await CoTParser.to_geojson(restored);

    assert.equal(after.path, '/Missions/Alpha/');
    assert.deepEqual(after.properties.metadata, { source: 'etl-test', priority: 7 });
});

test('Hub CoT round trip: GeoJSON feature', async () => {
    const cot = await CoTParser.from_geojson({
        id: 'test-feature',
        type: 'Feature',
        path: '/',
        properties: {
            callsign: 'TEST',
            type: 'a-f-G-E-V-C',
            how: 'm-g',
            archived: true,
            remarks: 'round trip',
        },
        geometry: {
            type: 'Point',
            coordinates: [-105.1, 39.9, 1600],
        },
    });

    const restored = CoTParser.from_xml(CoTParser.to_xml(cot));

    const before = await CoTParser.to_geojson(cot);
    const after = await CoTParser.to_geojson(restored);

    assert.deepEqual(after.geometry, before.geometry);
    assert.equal(after.properties.callsign, before.properties.callsign);
    assert.equal(after.properties.archived, before.properties.archived);
    assert.equal(after.properties.remarks, before.properties.remarks);
});
