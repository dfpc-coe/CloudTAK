import test from 'tape';
import Flight from './flight.js';
import MockVideoServer from './mock-video-server.js';

const flight = new Flight();
let mockVideoServer: MockVideoServer;

flight.init();
flight.takeoff();
flight.user();

test('Setup Mock Video Server', async (t) => {
    try {
        // Create mock video server
        mockVideoServer = new MockVideoServer({
            url: 'http://media:8080',
            configured: true
        });

        // Set media server URL in configuration
        await flight.config?.models.Setting.generate({
            key: 'media::url',
            value: 'http://media:8080'
        });

        t.pass('Mock video server setup complete');
    } catch (err) {
        t.error(err, 'no error setting up mock video server');
    }

    t.end();
});

test('GET: api/video/lease - Empty List', async (t) => {
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

test('POST: api/video/lease - Create Video Lease', async (t) => {
    try {
        const res = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Video Stream',
                ephemeral: false,
                duration: 3600,
                permanent: false,
                recording: false,
                publish: false,
                secure: false
            }
        }, true);

        t.equal(res.status, 200, 'Successful creation');
        t.ok(res.body.lease, 'Lease object returned');
        t.equal(res.body.lease.name, 'Test Video Stream', 'Correct lease name');
        t.ok(res.body.protocols, 'Protocols object returned');
    } catch (err) {
        t.error(err, 'no error creating video lease');
    }

    t.end();
});

test('GET: api/video/lease/:id - Get Specific Lease', async (t) => {
    try {
        // Create a lease first
        const createRes = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Get Lease',
                ephemeral: false,
                duration: 3600,
                recording: true,
                secure: true
            }
        }, true);

        const leaseId = createRes.body.lease.id;

        // Add the path to mock server for path info
        mockVideoServer.addPath(createRes.body.lease.path, {
            ready: true,
            tracks: ['video', 'audio'],
            bytesReceived: 1024,
            bytesSent: 512
        });

        const res = await flight.fetch(`/api/video/lease/${leaseId}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.equal(res.status, 200, 'Successful retrieval');
        t.ok(res.body.lease, 'Lease object returned');
        t.equal(res.body.lease.name, 'Test Get Lease', 'Correct lease name');
        t.ok(res.body.protocols, 'Protocols object returned');
        t.ok(res.body.path, 'Path information returned');
        t.ok(res.body.config, 'Config information returned');
    } catch (err) {
        t.error(err, 'no error getting video lease');
    }

    t.end();
});

test('PATCH: api/video/lease/:id - Update Video Lease', async (t) => {
    try {
        // Create a lease first
        const createRes = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Update Lease',
                ephemeral: false,
                duration: 3600
            }
        }, true);

        const leaseId = createRes.body.lease.id;

        const res = await flight.fetch(`/api/video/lease/${leaseId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Updated Test Lease',
                duration: 7200,
                recording: true,
                publish: true,
                secure: true
            }
        }, true);

        t.equal(res.status, 200, 'Successful update');
        t.ok(res.body.lease, 'Lease object returned');
        t.equal(res.body.lease.name, 'Updated Test Lease', 'Name updated correctly');
        t.equal(res.body.lease.recording, true, 'Recording enabled');
        t.equal(res.body.lease.publish, true, 'Publish enabled');
    } catch (err) {
        t.error(err, 'no error updating video lease');
    }

    t.end();
});

test('DELETE: api/video/lease/:id - Delete Video Lease', async (t) => {
    try {
        // Create a lease first
        const createRes = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Delete Lease',
                ephemeral: false,
                duration: 3600
            }
        }, true);

        const leaseId = createRes.body.lease.id;

        const res = await flight.fetch(`/api/video/lease/${leaseId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.equal(res.status, 200, 'Successful deletion');
        t.equal(res.body.message, 'Video Lease Deleted', 'Correct deletion message');
    } catch (err) {
        t.error(err, 'no error deleting video lease');
    }

    t.end();
});

test('POST: api/video/lease - With Proxy Stream', async (t) => {
    try {
        // Mock external HTTP stream
        const externalPool = mockVideoServer.getPool();
        externalPool.intercept({
            path: '/live/stream1.m3u8',
            method: 'GET'
        }).reply(200, '#EXTM3U\n#EXT-X-VERSION:3\n');

        const res = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Proxy Stream Test',
                ephemeral: false,
                duration: 3600,
                proxy: 'http://media:8080/live/stream1.m3u8'
            }
        }, true);

        t.equal(res.status, 200, 'Successful creation with proxy');
        t.ok(res.body.lease, 'Lease object returned');
        t.equal(res.body.lease.proxy, 'http://media:8080/live/stream1.m3u8', 'Proxy URL saved correctly');
    } catch (err) {
        t.error(err, 'no error creating proxy video lease');
    }

    t.end();
});

test('GET: api/video/active - Check Active Lease', async (t) => {
    try {
        // Create a lease first
        const createRes = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Active Test Lease',
                ephemeral: false,
                duration: 3600,
                secure: false
            }
        }, true);

        const lease = createRes.body.lease;
        const protocols = createRes.body.protocols;

        // Add path to mock as ready
        mockVideoServer.addPath(lease.path, {
            ready: true,
            readers: [{ type: 'hls', id: 'test-reader' }]
        });

        // Test with HLS URL
        const hlsUrl = protocols.hls?.url;
        if (hlsUrl) {
            const res = await flight.fetch(`/api/video/active?url=${encodeURIComponent(hlsUrl)}`, {
                method: 'GET',
                auth: {
                    bearer: flight.token.admin
                }
            }, true);

            t.equal(res.status, 200, 'Active lease check successful');
            t.equal(res.body.leasable, false, 'Lease is active');
            t.ok(res.body.metadata, 'Metadata returned');
            t.equal(res.body.metadata.name, 'Active Test Lease', 'Correct lease name in metadata');
            t.equal(res.body.metadata.active, true, 'Stream is active');
            t.equal(res.body.metadata.watchers, 1, 'Correct watcher count');
        }
    } catch (err) {
        t.error(err, 'no error checking active lease');
    }

    t.end();
});

test('Error Handling - Media Server Unconfigured', async (t) => {
    try {
        // Temporarily set mock as unconfigured
        mockVideoServer.setConfigured(false);

        const res = await flight.fetch('/api/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Should Fail',
                ephemeral: false,
                duration: 3600
            }
        }, false);

        t.equal(res.status, 400, 'Returns 400 when media server not configured');
        t.ok(res.body.message?.includes('Media Integration is not configured'), 'Correct error message');

        // Reset configuration
        mockVideoServer.setConfigured(true);
    } catch (err) {
        t.error(err, 'no error in error handling test');
    }

    t.end();
});

test('Cleanup Mock Video Server', async (t) => {
    try {
        mockVideoServer.close();
        t.pass('Mock video server cleaned up');
    } catch (err) {
        t.error(err, 'no error cleaning up mock video server');
    }

    t.end();
});

flight.landing();
