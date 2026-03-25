import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import Sinon from 'sinon';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/profile/overlay - empty', async () => {
    try {
        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
             removed: [],
             total: 0,
             items: [],
             available: {
                 terrain: false,
                 snapping: false
             }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/overlay - profile mode, S3 present -> kept in items', async () => {
    let stub: Sinon.SinonStub | undefined;

    try {
        const post = await flight.fetch('/api/profile/overlay', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Kept Profile Overlay',
                mode: 'profile',
                url: '/profile/admin@example.com/kept.pmtiles'
            }
        }, false);

        assert.equal(post.status, 200, `POST overlay failed: ${JSON.stringify(post.body)}`);

        stub = Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command instanceof HeadObjectCommand) return Promise.resolve({});
            throw new Error(`Unexpected S3 command: ${command.constructor.name}`);
        });

        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.removed.length, 0);
        assert.equal(res.body.items[0].name, 'Kept Profile Overlay');

        stub.restore();
        stub = undefined;

        // Explicit cleanup so subsequent tests start with an empty list
        await flight.fetch(`/api/profile/overlay?id=${post.body.id}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin }
        }, false);
    } catch (err) {
        assert.ifError(err);
    } finally {
        stub?.restore();
        Sinon.restore();
    }
});

test('GET: api/profile/overlay - profile mode, S3 absent -> moved to removed', async () => {
    let stub: Sinon.SinonStub | undefined;

    try {
        const post = await flight.fetch('/api/profile/overlay', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Missing Profile Overlay',
                mode: 'profile',
                url: '/profile/admin@example.com/gone.pmtiles'
            }
        }, false);

        assert.equal(post.status, 200, `POST overlay failed: ${JSON.stringify(post.body)}`);

        const notFound = new Error('Object not found');
        notFound.name = 'NotFound';

        stub = Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command instanceof HeadObjectCommand) return Promise.reject(notFound);
            throw new Error(`Unexpected S3 command: ${command.constructor.name}`);
        });

        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.equal(res.body.total, 0);
        assert.equal(res.body.items.length, 0);
        assert.equal(res.body.removed.length, 1);
        assert.equal(res.body.removed[0].name, 'Missing Profile Overlay');
    } catch (err) {
        assert.ifError(err);
    } finally {
        stub?.restore();
        Sinon.restore();
    }
});

test('GET: api/profile/overlay - data mode, S3 absent -> moved to removed', async () => {
    let stub: Sinon.SinonStub | undefined;

    try {
        const post = await flight.fetch('/api/profile/overlay', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Missing Data Overlay',
                mode: 'data',
                mode_id: 'layer-1',
                url: '/data/layer-1/mydata.pmtiles'
            }
        }, false);

        assert.equal(post.status, 200, `POST overlay failed: ${JSON.stringify(post.body)}`);

        const notFound = new Error('Object not found');
        notFound.name = 'NotFound';

        stub = Sinon.stub(S3Client.prototype, 'send').callsFake((command) => {
            if (command instanceof HeadObjectCommand) return Promise.reject(notFound);
            throw new Error(`Unexpected S3 command: ${command.constructor.name}`);
        });

        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.equal(res.body.total, 0);
        assert.equal(res.body.items.length, 0);
        assert.equal(res.body.removed.length, 1);
        assert.equal(res.body.removed[0].name, 'Missing Data Overlay');
    } catch (err) {
        assert.ifError(err);
    } finally {
        stub?.restore();
        Sinon.restore();
    }
});

test('POST: api/basemap - for overlay tests', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Overlay Test Basemap',
                url: 'https://tiles.example.com/basemap/{z}/{x}/{y}',
                sharing_enabled: false
            }
        }, true);

        assert.equal(res.body.id, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/overlay - basemap mode, basemap present -> kept in items', async () => {
    try {
        const post = await flight.fetch('/api/profile/overlay', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Kept Basemap Overlay',
                mode: 'basemap',
                mode_id: '1',
                url: 'https://tiles.example.com/basemap/{z}/{x}/{y}'
            }
        }, true);

        assert.equal(post.body.name, 'Kept Basemap Overlay');

        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.removed.length, 0);
        assert.equal(res.body.items[0].name, 'Kept Basemap Overlay');
        // basemap overlays carry TileJSON actions
        assert.ok(res.body.items[0].actions);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/overlay - basemap mode, basemap deleted -> moved to removed', async () => {
    try {
        // Delete the basemap created in the previous test; the overlay still references id=1
        await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: { bearer: flight.token.admin }
        }, false);

        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.equal(res.body.total, 0);
        assert.equal(res.body.items.length, 0);
        assert.equal(res.body.removed.length, 1);
        assert.equal(res.body.removed[0].name, 'Kept Basemap Overlay');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/profile/overlay - mission mode, access denied -> moved to removed', async () => {
    try {
        // Mock subscribe (PUT) so the POST overlay succeeds
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) return false;
            if (request.method === 'PUT' && request.url.includes('/Marti/api/missions/test-mission/subscription')) {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    version: '3',
                    type: 'com.bbn.marti.sync.model.MissionSubscription',
                    data: {
                        clientUid: 'ANDROID-CloudTAK-admin@example.com',
                        username: 'admin',
                        createTime: '2024-01-01T00:00:00Z',
                        role: {
                            type: 'MISSION_SUBSCRIBER',
                            permissions: []
                        }
                    }
                }));
                response.end();
                return true;
            }
            return false;
        });

        const post = await flight.fetch('/api/profile/overlay', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Denied Mission Overlay',
                mode: 'mission',
                mode_id: 'test-mission',
                url: 'https://tak.example.com/Marti/api/missions/test-mission'
            }
        }, false);

        assert.equal(post.status, 200, `POST overlay failed: ${JSON.stringify(post.body)}`);

        // Reset and set up access mock that denies access (empty data array)
        flight.tak.reset();
        flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
            if (!request.method || !request.url) return false;
            if (request.method === 'GET' && request.url.includes('/Marti/api/missions/test-mission')) {
                response.setHeader('Content-Type', 'application/json');
                response.write(JSON.stringify({
                    version: '3',
                    type: 'com.bbn.marti.sync.model.Mission',
                    data: []
                }));
                response.end();
                return true;
            }
            return false;
        });

        const res = await flight.fetch('/api/profile/overlay', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.equal(res.body.total, 0);
        assert.equal(res.body.items.length, 0);
        assert.equal(res.body.removed.length, 1);
        assert.equal(res.body.removed[0].name, 'Denied Mission Overlay');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

flight.landing();
