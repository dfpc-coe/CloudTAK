import test from 'node:test';
import assert from 'node:assert';
import { CoTParser } from '@tak-ps/node-cot';
import { TAKGroup, TAKRole } from '@tak-ps/node-tak/lib/api/types';
import { selfLocationFeature, SELF_COT_TYPE } from '../stateless/lib/profile-location.js';

const body = { longitude: -105.1, latitude: 39.9, altitude: 1600, accuracy: 4.2, speed: 1.5, bearing: 90, time: null };

test('Profile Location: Default Point Type SIDC never becomes the self CoT type', async () => {
    const cot = await CoTParser.from_geojson(selfLocationFeature('test@example.com', {
        tak_callsign: 'TEST',
        tak_type: '13031000000000000000',
        tak_group: TAKGroup.CYAN,
        tak_role: TAKRole.TEAM_MEMBER,
    } as Parameters<typeof selfLocationFeature>[1], body));

    assert.equal(cot.uid(), 'ANDROID-CloudTAK-test@example.com');
    assert.equal(cot.type(), SELF_COT_TYPE);
    assert.equal(cot.raw.event.detail?.__milicon, undefined);
    assert.equal(cot.raw.event.detail?.__milsym, undefined);
    assert.deepEqual(cot.raw.event.detail?.__group?._attributes, { name: 'Cyan', role: 'Team Member' });
    assert.deepEqual(cot.raw.event.detail?.contact?._attributes, { endpoint: '*:-1:stcp', callsign: 'TEST' });
    assert.equal(cot.raw.event.point._attributes.lon, -105.1);
    assert.equal(cot.raw.event.point._attributes.lat, 39.9);
    assert.equal(cot.raw.event.point._attributes.hae, 1600);
    assert.equal(cot.raw.event.detail?.track?._attributes?.speed, 1.5);
    assert.equal(cot.raw.event.detail?.track?._attributes?.course, 90);
});

test('Profile Location: profile defaults', async () => {
    const cot = await CoTParser.from_geojson(selfLocationFeature('test@example.com', {}, {
        longitude: 0, latitude: 0, altitude: null, accuracy: null, speed: null, bearing: null, time: 1_700_000_000_000,
    }));

    assert.equal(cot.callsign(), 'Unknown');
    assert.equal(cot.raw.event._attributes.time, '2023-11-14T22:13:20.000Z');
    assert.equal(cot.raw.event._attributes.stale, '2023-11-14T22:14:20.000Z');
    assert.deepEqual(cot.raw.event.detail?.__group?._attributes, { name: 'Cyan', role: 'Team Member' });
    assert.equal(cot.raw.event.detail?.track, undefined);
    assert.equal(cot.raw.event.point._attributes.hae, 0);
});
