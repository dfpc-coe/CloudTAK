import test from 'node:test';
import assert from 'node:assert';
import WebSocket from 'ws';
import { CoTParser } from '@tak-ps/node-cot';
import type CoT from '@tak-ps/node-cot';
import { TAKGroup, TAKRole } from '@tak-ps/node-tak/lib/api/types';
import LocalHub from '../stateful/lib/hub/local.js';
import LocationArbiter from '../stateful/lib/location-arbiter.js';
import { ConnectionWebSocket } from '../stateful/lib/connection-web.js';
import type { ConnectionClient } from '../stateful/lib/connection-pool.js';
import { ProfileConnConfig } from '../common/connection-config.js';
import { selfLocationFeature } from '../stateless/lib/profile-location.js';
import { WebSocket_Event } from '../common/enums.js';
import type ConfigStateful from '../stateful/config.js';

const USER = 'test@example.com';

function rig() {
    const clock = { t: 1_000_000 };
    const arbiter = new LocationArbiter({ now: () => clock.t });
    const written: CoT[][] = [];
    const relayed: Array<{ cots: CoT[]; excludeSession?: string }> = [];
    const statuses: string[] = [];
    const config = {
        locationArbiter: arbiter,
        conns: {
            sendStatus: (id: string) => { statuses.push(id); },
            cots: async (_conn: unknown, cots: CoT[], opts: { excludeSession?: string } = {}) => {
                relayed.push({ cots, excludeSession: opts.excludeSession });
            },
        },
    } as unknown as ConfigStateful;
    const profile = new ProfileConnConfig(config, USER, { cert: 'c', key: 'k' } as ProfileConnConfig['auth']);
    const client = {
        config: profile,
        tak: { write: (cots: CoT[]) => { written.push(cots); } },
    } as unknown as ConnectionClient;
    (config.conns as unknown as { get: () => ConnectionClient }).get = () => client;
    return { arbiter, config, profile, client, written, relayed, statuses, advance: (ms: number) => { clock.t += ms; } };
}

async function selfCot(longitude: number, latitude: number, accuracy?: number): Promise<CoT> {
    return await CoTParser.from_geojson(selfLocationFeature(USER, {
        tak_callsign: 'TEST',
        tak_group: TAKGroup.CYAN,
        tak_role: TAKRole.TEAM_MEMBER,
    } as Parameters<typeof selfLocationFeature>[1], { longitude, latitude, accuracy }));
}

function selfFeature(longitude: number, latitude: number, accuracy?: number) {
    return selfLocationFeature(USER, {
        tak_callsign: 'TEST',
        tak_group: TAKGroup.CYAN,
        tak_role: TAKRole.TEAM_MEMBER,
    } as Parameters<typeof selfLocationFeature>[1], { longitude, latitude, accuracy });
}

function socket(client: ConnectionClient, session: string) {
    let onMessage: ((data: string) => Promise<void>) | undefined;
    const ws = {
        readyState: WebSocket.OPEN,
        send: () => {},
        on: (_event: string, handler: (data: string) => Promise<void>) => { onMessage = handler; },
    } as unknown as WebSocket;
    new ConnectionWebSocket(ws, 'geojson', [WebSocket_Event.MAP], client, session);
    return async (msg: object) => { await (onMessage as (data: string) => Promise<void>)(JSON.stringify(msg)); };
}

test('LocalHub.submitCots: the broadcaster is forwarded and relayed to the other sessions', async () => {
    const { config, written, relayed } = rig();
    const hub = new LocalHub(config);
    await hub.submitCots({
        connection: USER,
        cots: [await selfCot(174.77, -41.28, 8)],
        selfLocation: { session: 'phone', source: 'gps', accuracy: 8 },
    });
    assert.equal(written.length, 1);
    assert.equal(relayed.length, 1);
    assert.equal(relayed[0].excludeSession, 'phone');
});

test('LocalHub.submitCots: a second session is forwarded as a marker of its own', async () => {
    const { config, written, relayed, advance } = rig();
    const hub = new LocalHub(config);
    const send = async (session: string, accuracy: number) => hub.submitCots({
        connection: USER,
        cots: [await selfCot(174.77, -41.28, accuracy)],
        selfLocation: { session, source: 'gps', accuracy },
    });
    await send('phone', 8);
    advance(1000);
    await send('tablet', 10);
    assert.equal(written.length, 2);
    assert.equal(relayed.length, 2);
    assert.equal(relayed[1].excludeSession, 'tablet');

    const self = written[0][0];
    const marker = written[1][0];
    assert.notEqual(marker.uid(), self.uid());
    assert.equal(marker.callsign(), 'TEST');
    assert.equal(marker.detail().__group, undefined);
    assert.equal(marker.detail().contact?._attributes.endpoint, undefined);
    assert.deepEqual(marker.position(), self.position());

    advance(1000);
    await send('tablet', 10);
    assert.equal(written[2][0].uid(), marker.uid(), 'the marker keeps its uid');
});

test('LocalHub.submitCots: 0,0 is forwarded but not relayed while no session has a position', async () => {
    const { config, written, relayed } = rig();
    const hub = new LocalHub(config);
    await hub.submitCots({
        connection: USER,
        cots: [await selfCot(0, 0, 8)],
        selfLocation: { session: 'phone', source: 'none' },
    });
    assert.equal(written.length, 1);
    assert.equal(relayed.length, 0);
});

test('LocalHub.submitCots: CoTs without selfLocation are untouched', async () => {
    const { config, written } = rig();
    const hub = new LocalHub(config);
    await hub.submitCots({ connection: USER, cots: [await selfCot(0, 0)] });
    assert.equal(written.length, 1);
});

test('ConnectionWebSocket: the user\'s own position is arbitrated and relayed, 0,0 is dropped while another session broadcasts', async () => {
    const { client, written, relayed, advance } = rig();
    const phone = socket(client, 'phone');
    const laptop = socket(client, 'laptop');

    await phone({ type: 'cot', data: selfFeature(174.77, -41.28, 8) });
    assert.equal(written.length, 1);
    assert.equal(relayed.length, 1);
    assert.equal(relayed[0].excludeSession, 'phone');

    advance(1000);
    await laptop({ type: 'cot', data: selfFeature(174.77, -41.28, 12) });
    assert.equal(written.length, 2);
    assert.notEqual(written[1][0].uid(), written[0][0].uid(), 'standby session is forwarded as its own marker');

    await laptop({ type: 'cot', data: selfFeature(0, 0) });
    assert.equal(written.length, 2, '0,0 is not forwarded over a live broadcaster');
});

test('ConnectionWebSocket: Take over moves the role on the claimant\'s next fix', async () => {
    const { client, written, statuses, advance } = rig();
    const phone = socket(client, 'phone');
    const laptop = socket(client, 'laptop');
    await phone({ type: 'cot', data: selfFeature(174.77, -41.28, 8) });
    advance(1000);
    await laptop({ type: 'broadcast:claim' });
    statuses.length = 0;
    await laptop({ type: 'cot', data: selfFeature(174.80, -41.30) });
    assert.equal(written.length, 2);
    assert.deepEqual(statuses, [USER], 'the user\'s sessions are told straight away');
    assert.equal(written[1][0].uid(), written[0][0].uid(), 'the laptop is now the user');
    advance(1000);
    await phone({ type: 'cot', data: selfFeature(174.77, -41.28, 8) });
    assert.notEqual(written[2][0].uid(), written[0][0].uid(), 'the phone is now on standby');
});

test('ConnectionWebSocket: other CoTs from the user are not arbitrated', async () => {
    const { client, written } = rig();
    const phone = socket(client, 'phone');
    const marker = selfFeature(174.77, -41.28, 8);
    marker.id = 'some-other-marker';
    await phone({ type: 'cot', data: marker });
    await phone({ type: 'cot', data: marker });
    assert.equal(written.length, 2);
});
