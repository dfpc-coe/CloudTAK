import test from 'tape';
import Flight from './flight.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/video/lease - MediaServer Query', async (t) => {
    try {
        const res = await flight.fetch('/api/video/lease?impersonate=true&ephemeral=all', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

let agent: MockAgent;
let originalDispatcher: any;
let leaseId: number;
let leasePath: string;

test('Mock Media Server Start', async (t) => {
    originalDispatcher = getGlobalDispatcher();
    agent = new MockAgent();
    agent.disableNetConnect();
    agent.enableNetConnect('localhost:5001');
    setGlobalDispatcher(agent);

    const mediaClient = agent.get('http://media-server:9997');
    mediaClient.intercept({
        path: '/path',
        method: 'POST'
    }).reply(200, {});

    try {
        await flight.config!.models.Setting.generate({
            key: 'media::url',
            value: 'http://media-server'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/video/lease - Create Lease', async (t) => {
    try {
        const res = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Lease',
                duration: 3600
            }
        }, true);

        t.equals(res.status, 200, 'Status 200');
        t.ok(res.body.id, 'Lease ID returned');
        t.equals(res.body.name, 'Test Lease', 'Name matches');
        leaseId = res.body.id;
        leasePath = res.body.path;
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/video/lease/:lease - Get Lease', async (t) => {
    try {
        const res = await flight.fetch(`/api/video/lease/${leaseId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.equals(res.status, 200, 'Status 200');
        t.equals(res.body.id, leaseId, 'Lease ID matches');
        t.equals(res.body.name, 'Test Lease', 'Name matches');
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PATCH: api/video/lease/:lease - Update Lease', async (t) => {
    const mediaClient = agent.get('http://media-server:9997');

    mediaClient.intercept({
        path: `/path/${leasePath}`,
        method: 'GET'
    }).reply(200, {
        name: leasePath,
        confName: leasePath,
        source: null,
        ready: true,
        readyTime: null,
        tracks: [],
        bytesReceived: 0,
        bytesSent: 0,
        readers: []
    });

    mediaClient.intercept({
        path: `/path/${leasePath}`,
        method: 'PATCH'
    }).reply(200, {});

    try {
        const res = await flight.fetch(`/api/video/lease/${leaseId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Updated Lease Name',
                recording: false,
                publish: false
            }
        }, true);

        t.equals(res.status, 200, 'Status 200');
        t.equals(res.body.id, leaseId, 'Lease ID matches');
        t.equals(res.body.name, 'Updated Lease Name', 'Name updated');
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('Mock Media Server Stop', async (t) => {
    setGlobalDispatcher(originalDispatcher);
    await agent.close();
    t.end();
});

flight.landing();
