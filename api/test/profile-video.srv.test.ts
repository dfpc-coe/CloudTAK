import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/profile/video', async () => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/video - no lease or url', async () => {
    const res = await flight.fetch('/api/profile/video', {
        method: 'POST',
        auth: {
            bearer: flight.token.admin,
        },
        body: {},
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Either a lease or url must be provided');
});

test('POST: api/profile/video - url without media server', async () => {
    const res = await flight.fetch('/api/profile/video', {
        method: 'POST',
        auth: {
            bearer: flight.token.admin,
        },
        body: {
            url: 'rtsp://example.com:8554/stream',
        },
    }, false);

    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Media Integration is not configured');
});

let agent: MockAgent;
let originalDispatcher: any;
let leaseId: number;
let leasePath: string;
let videoId: string;
let proxyVideoId: string;

test('Mock Media Server Start', async () => {
    originalDispatcher = getGlobalDispatcher();
    agent = new MockAgent();
    agent.disableNetConnect();
    agent.enableNetConnect(new URL(flight.base).host);
    setGlobalDispatcher(agent);

    const mediaClient = agent.get('http://media-server:9997');
    mediaClient.intercept({
        path: '/path',
        method: 'POST',
    }).reply(200, {}).persist();

    mediaClient.intercept({
        path: '/v3/config/global/get',
        method: 'GET',
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
        srtAddress: '',
    }).persist();

    mediaClient.intercept({
        path: '/path',
        method: 'GET',
    }).reply(200, {
        pageCount: 0,
        itemCount: 0,
        items: [],
    }).persist();

    try {
        await flight.config!.models.Setting.generate({
            key: 'media::url',
            value: 'http://media-server',
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
                bearer: flight.token.admin,
            },
            body: {
                name: 'Wall Lease',
                duration: 3600,
            },
        }, true);

        assert.equal(res.status, 200, 'Status 200');
        leaseId = res.body.id;
        leasePath = res.body.path;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/video - from lease', async () => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                lease: leaseId,
            },
        }, true);

        assert.equal(res.status, 200, 'Status 200');
        assert.ok(res.body.id, 'Video ID returned');
        assert.equal(res.body.lease, leaseId, 'Lease matches');
        assert.equal(res.body.username, 'admin@example.com', 'Username matches');
        assert.deepEqual(res.body.position, { x: 0, y: 0, w: 4, h: 6 }, 'Default Position');

        videoId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/video - duplicate lease returns existing', async () => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                lease: leaseId,
            },
        }, true);

        assert.equal(res.status, 200, 'Status 200');
        assert.equal(res.body.id, videoId, 'Existing Video returned');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/video - url resolving to existing lease', async () => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                url: `http://media-server:8888/${leasePath}/index.m3u8`,
            },
        }, true);

        assert.equal(res.status, 200, 'Status 200');
        assert.equal(res.body.id, videoId, 'Existing Video returned');
        assert.equal(res.body.lease, leaseId, 'Lease matches');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/video - external url creates proxy lease', async () => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                url: 'rtsp://example.com:8554/external-stream',
                name: 'External Camera',
            },
        }, true);

        assert.equal(res.status, 200, 'Status 200');
        assert.ok(res.body.id, 'Video ID returned');
        assert.notEqual(res.body.lease, leaseId, 'New Lease created');
        assert.deepEqual(res.body.position, { x: 0, y: 6, w: 4, h: 6 }, 'Placed below existing videos');

        proxyVideoId = res.body.id;

        const lease = await flight.fetch(`/api/video/lease/${res.body.lease}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(lease.body.name, 'External Camera', 'Lease Name from body');
        assert.equal(lease.body.proxy, 'rtsp://example.com:8554/external-stream', 'Lease proxies the URL');
        assert.equal(lease.body.ephemeral, true, 'Lease is ephemeral');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/profile/video/:id - update position', async () => {
    try {
        const res = await flight.fetch(`/api/profile/video/${videoId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                position: { x: 4, y: 0, w: 8, h: 8 },
            },
        }, true);

        assert.equal(res.status, 200, 'Status 200');
        assert.deepEqual(res.body.position, { x: 4, y: 0, w: 8, h: 8 }, 'Position updated');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/video/:id', async () => {
    try {
        const res = await flight.fetch(`/api/profile/video/${videoId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200, 'Status 200');
        assert.equal(res.body.lease, leaseId, 'Lease matches');
        assert.deepEqual(res.body.position, { x: 4, y: 0, w: 8, h: 8 }, 'Position persisted');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/video - list', async () => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 2, 'Two Videos');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/profile/video/:id', async () => {
    try {
        const res = await flight.fetch(`/api/profile/video/${proxyVideoId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200, 'Status 200');

        const list = await flight.fetch('/api/profile/video', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1, 'One Video remains');
    } catch (err) {
        assert.ifError(err);
    }
});

test('Mock Media Server Stop', async () => {
    setGlobalDispatcher(originalDispatcher);
    await agent.close();
});

flight.landing();
