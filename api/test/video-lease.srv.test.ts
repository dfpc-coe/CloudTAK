import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/video/lease - MediaServer Query', async () => {
    try {
        const res = await flight.fetch('/api/video/lease?impersonate=true&ephemeral=all', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

let agent: MockAgent;
let originalDispatcher: any;
let leaseId: number;
let leasePath: string;

test('Mock Media Server Start', async () => {
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

    mediaClient.intercept({
        path: '/v3/config/global/get',
        method: 'GET'
    }).reply(200, {
        api: true,
        apiAddress: ':9997',
        metrics: true,
        metricsAddress: ':9998',
        pprof: false,
        pprofAddress: '',
        playback: false,
        playbackAddress: '',
        rtsp: true,
        rtspAddress: ':8554',
        rtspsAddress: '',
        rtspAuthMethods: [],
        rtmp: true,
        rtmpAddress: ':1935',
        rtmpsAddress: '',
        hls: true,
        hlsAddress: ':8888',
        webrtc: false,
        webrtcAddress: '',
        srt: false,
        srtAddress: ''
    }).persist();

    mediaClient.intercept({
        path: '/path',
        method: 'GET'
    }).reply(200, {
        pageCount: 0,
        itemCount: 0,
        items: []
    }).persist();


    try {
        await flight.config!.models.Setting.generate({
            key: 'media::url',
            value: 'http://media-server'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/video/lease - Create Lease', async () => {
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

        assert.equal(res.status, 200, 'Status 200');
        assert.ok(res.body.id, 'Lease ID returned');
        assert.equal(res.body.name, 'Test Lease', 'Name matches');
        leaseId = res.body.id;
        leasePath = res.body.path;
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/video/lease/:lease - Get Lease', async () => {
    try {
        const res = await flight.fetch(`/api/video/lease/${leaseId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.equal(res.status, 200, 'Status 200');
        assert.equal(res.body.id, leaseId, 'Lease ID matches');
        assert.equal(res.body.name, 'Test Lease', 'Name matches');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/video/lease/:lease - Update Lease', async () => {
    flight.tak.mockMarti.push(async (request, response) => {
        if (request.method === 'DELETE' && request.url && request.url.startsWith('/Marti/api/video/')) {
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({}));
            response.end();
            return true;
        } else if (request.method === 'POST' && request.url && request.url.startsWith('/Marti/api/video')) {
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({}));
            response.end();
            return true;
        } else if (request.method === 'GET' && request.url && request.url.startsWith('/Marti/api/video/')) {
            response.setHeader('Content-Type', 'application/json');
            response.write(JSON.stringify({}));
            response.end();
            return true;
        }
        return false;
    });

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

        assert.equal(res.status, 200, 'Status 200');
        assert.equal(res.body.id, leaseId, 'Lease ID matches');
        assert.equal(res.body.name, 'Updated Lease Name', 'Name updated');
    } catch (err) {
        assert.ifError(err);
    }
});

test('Mock Media Server Stop', async () => {
    setGlobalDispatcher(originalDispatcher);
    await agent.close();
});

flight.landing();
