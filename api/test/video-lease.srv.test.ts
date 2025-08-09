import test from 'tape';
import MockVideoServer from './mock-video-server.js';

test('MockVideoServer: Integration with Video Service Control', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        // Import video service after mock is set up
        const { default: VideoServiceControl } = await import('../lib/control/video-service.js');
        
        // Create minimal mock config
        const mockConfig = {
            MediaSecret: 'test-secret',
            models: {
                Setting: {
                    from: async (key: string) => {
                        if (key === 'media::url') {
                            return { value: 'http://media:8080' };
                        }
                        throw new Error('Not Found');
                    }
                }
            }
        };

        const videoControl = new VideoServiceControl(mockConfig as any);

        // Test 1: Configuration retrieval
        const config = await videoControl.configuration();
        t.ok(config.configured, 'Video service is configured');
        t.equal(config.url, 'http://media:8080', 'Correct URL');
        t.ok(config.config?.rtsp, 'RTSP enabled');
        t.ok(config.config?.hls, 'HLS enabled');

        // Test 2: Add a path and verify it exists
        mockVideoServer.addPath('test-integration-path', {
            ready: true,
            tracks: ['video', 'audio'],
            bytesReceived: 2048
        });

        const pathInfo = await videoControl.path('test-integration-path');
        t.equal(pathInfo.name, 'test-integration-path', 'Path retrieved correctly');
        t.equal(pathInfo.ready, true, 'Path is ready');
        t.equal(pathInfo.bytesReceived, 2048, 'Correct bytes received');

        // Test 3: Protocol generation
        const mockLease = {
            id: 1,
            name: 'Test Stream',
            path: 'test-protocols',
            recording: false,
            publish: false,
            username: 'test@example.com',
            expiration: null,
            ephemeral: false,
            source_id: null,
            source_type: undefined,
            source_model: null,
            connection: null,
            layer: null,
            channel: null,
            proxy: null,
            stream_user: null,
            stream_pass: null,
            read_user: null,
            read_pass: null,
            created: new Date().toISOString(),
            updated: new Date().toISOString()
        };

        const protocols = await videoControl.protocols(mockLease);
        t.ok(protocols.rtsp, 'RTSP protocol generated');
        t.ok(protocols.hls, 'HLS protocol generated');
        t.ok(protocols.webrtc, 'WebRTC protocol generated');
        t.ok(protocols.rtsp?.url.includes('test-protocols'), 'RTSP URL contains path');

        // Test 4: Error handling
        try {
            await videoControl.path('non-existent-path');
            t.fail('Should throw error for non-existent path');
        } catch (err: any) {
            t.ok(err.message.includes('Media Server Error'), 'Proper error handling');
        }

        t.pass('All integration tests passed');
    } catch (err) {
        t.error(err, 'no errors in integration test');
    }

    mockVideoServer.close();
    t.end();
});

test('MockVideoServer: Demonstrates Video Server Communication Mocking', async (t) => {
    // This test demonstrates how the mock server intercepts undici requests
    // that would normally go to a MediaMTX server

    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        // Import the fetch function that video-service.ts uses
        const { default: fetch } = await import('../lib/fetch.js');

        // Test global config endpoint (used by VideoServiceControl.configuration())
        const configRes = await fetch('http://media:8080/v3/config/global/get', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        t.equal(configRes.status, 200, 'Config endpoint mocked successfully');
        const configBody = await configRes.json();
        t.ok(configBody.rtsp, 'Mock returns RTSP config');
        t.ok(configBody.hls, 'Mock returns HLS config');

        // Test path creation (used by VideoServiceControl.generate())
        const createPathRes = await fetch('http://media:8080/v3/config/paths/add/demo-stream', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'demo-stream',
                record: true,
                maxReaders: 10
            })
        });

        t.equal(createPathRes.status, 200, 'Path creation endpoint mocked successfully');

        // Test path retrieval (used by VideoServiceControl.path())
        const pathRes = await fetch('http://media:8080/v3/paths/get/demo-stream', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        t.equal(pathRes.status, 200, 'Path retrieval endpoint mocked successfully');
        const pathBody = await pathRes.json();
        t.equal(pathBody.name, 'demo-stream', 'Mock returns correct path data');

        // Test paths list (used by VideoServiceControl.configuration())
        const listRes = await fetch('http://media:8080/v3/paths/list', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        t.equal(listRes.status, 200, 'Paths list endpoint mocked successfully');
        const listBody = await listRes.json();
        t.equal(listBody.itemCount, 1, 'Mock shows one path in list');
        t.equal(listBody.items[0].name, 'demo-stream', 'Correct path in list');

        t.pass('All endpoint mocking demonstrations passed');
    } catch (err) {
        t.error(err, 'no errors in endpoint mocking test');
    }

    mockVideoServer.close();
    t.end();
});
