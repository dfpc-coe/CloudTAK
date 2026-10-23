import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { AdminConnConfig } from '../common/connection-config.js';
import { setChannels } from '../common/models/CoreEntity.js';
import type TAK from '@tak-ps/node-tak';
import type { TAKAPI } from '@tak-ps/node-tak';
import type CoT from '@tak-ps/node-cot';
import { CoTParser } from '@tak-ps/node-cot';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();

const point = { type: 'Point' as const, coordinates: [-105.0, 39.7] };

let eventId: string;
let endedEventId: string;
let deviceId: string;
let unlocatedDeviceId: string;
let unsharedDeviceId: string;

/** Run one submit cycle against a fake TAK socket & Group API and return the CoTs written */
async function broadcast(entity?: string, admin = new AdminConnConfig(flight.stateful!)): Promise<CoT[]> {
    const written: CoT[] = [];

    await admin.submitEntities(
        { open: true, write: (cots: CoT[]) => written.push(...cots) } as unknown as TAK,
        { Group: { list: async () => ({ data: [{ bitpos: 1, name: 'Shared Group' }] }) } } as unknown as TAKAPI,
        entity ? { entity } : undefined,
    );

    return written;
}

test('Broadcast: seed Events & Devices', async () => {
    const models = flight.config!.models;
    const pg = flight.config!.pg;

    eventId = await models.CoreEntity.generateEvent({ name: 'Active Event', type: '10031000001211000000', geometry: point, location: 'Denver', remarks: 'Event remarks' });
    await setChannels(pg, eventId, [1]);

    endedEventId = await models.CoreEntity.generateEvent({ name: 'Ended Event', type: '10031000001211000000', geometry: point, ended: '2020-01-01T00:00:00Z' });
    await setChannels(pg, endedEventId, [1]);

    deviceId = await models.CoreDevice.generateDevice({ name: 'Located Device', type: '10031000001211000000', geometry: point, status: 'Full', battery: 50, remarks: 'Device remarks' });
    await setChannels(pg, deviceId, [1]);

    unlocatedDeviceId = await models.CoreDevice.generateDevice({ name: 'Unlocated Device', type: '10031000001211000000' });
    await setChannels(pg, unlocatedDeviceId, [1]);

    unsharedDeviceId = await models.CoreDevice.generateDevice({ name: 'Unshared Device', type: '10031000001211000000', geometry: point });
    await setChannels(pg, unsharedDeviceId, [2]);
});

test('Broadcast: active Events & located Devices on a resolvable Channel are written as CoT', async () => {
    const cots = await broadcast();

    assert.deepEqual(cots.map(cot => cot.uid()).sort(), [eventId, deviceId].sort());

    const event = await CoTParser.to_geojson(cots.find(cot => cot.uid() === eventId)!);
    assert.equal(event.properties.callsign, 'Active Event');
    assert.equal(event.properties.how, 'm-g');
    assert.equal(event.properties.remarks, 'Location:\nDenver\n\nPriority:\nnone\n\nEvent remarks');
    assert.deepEqual([event.properties.dest].flat(), [{ group: 'Shared Group' }]);
    assert.deepEqual(event.properties.links, [{
        relation: 'p',
        type: 'core-event',
        event: eventId,
        url: `${flight.stateful!.API_URL}/event/${eventId}`,
        remarks: 'Active Event',
    }]);

    const device = await CoTParser.to_geojson(cots.find(cot => cot.uid() === deviceId)!);
    assert.equal(device.properties.callsign, 'Located Device');
    assert.equal(device.properties.how, 'm-g');
    assert.equal(device.properties.remarks, 'Device remarks');
    assert.deepEqual([device.properties.dest].flat(), [{ group: 'Shared Group' }]);
    assert.deepEqual(device.properties.links, [{
        relation: 'p',
        type: 'core-device',
        device: deviceId,
        url: `${flight.stateful!.API_URL}/device/${deviceId}`,
        remarks: 'Located Device',
    }]);
    assert.deepEqual(device.geometry.coordinates.slice(0, 2), point.coordinates);
});

test('Broadcast: a single Entity can be submitted on its own', async () => {
    const cots = await broadcast(deviceId);
    assert.deepEqual(cots.map(cot => cot.uid()), [deviceId]);

    assert.deepEqual(await broadcast(unlocatedDeviceId), []);
    assert.deepEqual(await broadcast(unsharedDeviceId), []);
    assert.deepEqual(await broadcast(endedEventId), []);
});

test('Broadcast: an Entity is immediately submitted at most once per interval', async () => {
    const admin = new AdminConnConfig(flight.stateful!);

    assert.deepEqual((await broadcast(deviceId, admin)).map(cot => cot.uid()), [deviceId]);
    assert.deepEqual(await broadcast(deviceId, admin), []);

    // The sweep is never throttled and restarts the interval for every Entity it broadcasts
    const sweep = (await broadcast(undefined, admin)).map(cot => cot.uid()).sort();
    assert.deepEqual(sweep, [deviceId, eventId].sort());
    assert.deepEqual(await broadcast(eventId, admin), []);

    // An Entity dropped by the sweep is no longer throttled
    admin.lastBroadcast.set(unlocatedDeviceId, Date.now());
    assert.deepEqual(await broadcast(undefined, admin).then(cots => cots.length), 2);
    assert.equal(admin.lastBroadcast.has(unlocatedDeviceId), false);
});

flight.landing();
