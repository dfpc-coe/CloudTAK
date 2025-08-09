import test from 'tape';
import MockVideoServer from './mock-video-server.js';
import fetch from '../lib/fetch.js';

test('MockVideoServer: Basic Setup and Teardown', async (t) => {
    try {
        const mockVideoServer = new MockVideoServer({
            url: 'http://media:8080',
            configured: true
        });

        t.pass('Mock video server created successfully');

        mockVideoServer.close();
        t.pass('Mock video server closed successfully');
    } catch (err) {
        t.error(err, 'no error setting up and tearing down mock video server');
    }

    t.end();
});

test('MockVideoServer: Global Config Endpoint', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        const res = await fetch('http://media:8080/v3/config/global/get', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        t.equal(res.status, 200, 'Config endpoint returns 200');
        
        const body = await res.json();
        t.ok(body.api, 'API configuration present');
        t.ok(body.rtsp, 'RTSP configuration present');
        t.ok(body.hls, 'HLS configuration present');
        t.ok(body.webrtc, 'WebRTC configuration present');
    } catch (err) {
        t.error(err, 'no error fetching global config');
    }

    mockVideoServer.close();
    t.end();
});

test('MockVideoServer: Paths List Endpoint', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        // Add a test path
        mockVideoServer.addPath('test-path-123', {
            ready: true,
            tracks: ['video', 'audio'],
            bytesReceived: 1024,
            readers: [{ type: 'hls', id: 'reader-1' }]
        });

        const res = await fetch('http://media:8080/v3/paths/list', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        t.equal(res.status, 200, 'Paths list endpoint returns 200');
        
        const body = await res.json();
        t.equal(body.itemCount, 1, 'One path in list');
        t.equal(body.items[0].name, 'test-path-123', 'Correct path name');
        t.equal(body.items[0].ready, true, 'Path is ready');
        t.equal(body.items[0].readers.length, 1, 'One reader present');
    } catch (err) {
        t.error(err, 'no error fetching paths list');
    }

    mockVideoServer.close();
    t.end();
});

test('MockVideoServer: Add Path Endpoint', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        const pathConfig = {
            name: 'new-test-path',
            record: true,
            maxReaders: 5
        };

        const res = await fetch('http://media:8080/v3/config/paths/add/new-test-path', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64'),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pathConfig)
        });

        t.equal(res.status, 200, 'Add path endpoint returns 200');

        // Verify the path was added by checking the list
        const listRes = await fetch('http://media:8080/v3/paths/list', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        const listBody = await listRes.json();
        t.equal(listBody.itemCount, 1, 'Path was added to list');
        t.equal(listBody.items[0].name, 'new-test-path', 'Correct path name in list');
    } catch (err) {
        t.error(err, 'no error adding path');
    }

    mockVideoServer.close();
    t.end();
});

test('MockVideoServer: Get Path Endpoint', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        // Add a path first
        mockVideoServer.addPath('get-test-path', {
            ready: true,
            tracks: ['video', 'audio'],
            bytesReceived: 2048,
            bytesSent: 1024
        });

        const res = await fetch('http://media:8080/v3/paths/get/get-test-path', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        t.equal(res.status, 200, 'Get path endpoint returns 200');
        
        const body = await res.json();
        t.equal(body.name, 'get-test-path', 'Correct path name');
        t.equal(body.ready, true, 'Path is ready');
        t.equal(body.bytesReceived, 2048, 'Correct bytes received');
        t.equal(body.bytesSent, 1024, 'Correct bytes sent');
        t.deepEqual(body.tracks, ['video', 'audio'], 'Correct tracks');
    } catch (err) {
        t.error(err, 'no error getting path');
    }

    mockVideoServer.close();
    t.end();
});

test('MockVideoServer: Get Non-Existent Path', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        const res = await fetch('http://media:8080/v3/paths/get/non-existent-path', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        t.equal(res.status, 404, 'Non-existent path returns 404');
        
        const body = await res.json();
        t.ok(body.error, 'Error message present');
    } catch (err) {
        t.error(err, 'no error handling non-existent path');
    }

    mockVideoServer.close();
    t.end();
});

test('MockVideoServer: Delete Path Endpoint', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        // Add a path first
        mockVideoServer.addPath('delete-test-path');

        // Verify it exists
        let listRes = await fetch('http://media:8080/v3/paths/list', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });
        let listBody = await listRes.json();
        t.equal(listBody.itemCount, 1, 'Path exists before deletion');

        // Delete the path
        const deleteRes = await fetch('http://media:8080/v3/config/paths/delete/delete-test-path', {
            method: 'DELETE',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        t.equal(deleteRes.status, 200, 'Delete path endpoint returns 200');

        // Verify it's gone
        try {
            listRes = await fetch('http://media:8080/v3/paths/list', {
                method: 'GET',
                headers: {
                    'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
                }
            });
            listBody = await listRes.json();
            t.equal(listBody.itemCount, 0, 'Path was deleted from list');
        } catch (fetchErr) {
            t.error(fetchErr, 'fetch after deletion should not fail');
        }
    } catch (err) {
        t.error(err, 'no error deleting path');
    }

    mockVideoServer.close();
    t.end();
});

test('MockVideoServer: Helper Methods', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        // Test addPath helper
        mockVideoServer.addPath('helper-test-path', {
            ready: false,
            tracks: ['video']
        });

        // Test setPathReady helper
        mockVideoServer.setPathReady('helper-test-path', true);

        // Test addPathReader helper
        mockVideoServer.addPathReader('helper-test-path', { type: 'webrtc', id: 'reader-webrtc' });

        // Verify the changes
        const res = await fetch('http://media:8080/v3/paths/get/helper-test-path', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });

        const body = await res.json();
        t.equal(body.ready, true, 'Path ready status updated');
        t.ok(body.readyTime, 'Ready time set');
        t.equal(body.readers.length, 1, 'Reader added');
        t.equal(body.readers[0].type, 'webrtc', 'Correct reader type');
    } catch (err) {
        t.error(err, 'no error using helper methods');
    }

    mockVideoServer.close();
    t.end();
});

test('MockVideoServer: Reset Functionality', async (t) => {
    const mockVideoServer = new MockVideoServer({
        url: 'http://media:8080',
        configured: true
    });

    try {
        // Add some paths
        mockVideoServer.addPath('reset-test-1');
        mockVideoServer.addPath('reset-test-2');

        // Verify they exist
        let listRes = await fetch('http://media:8080/v3/paths/list', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });
        let listBody = await listRes.json();
        t.equal(listBody.itemCount, 2, 'Two paths exist before reset');

        // Reset the mock server
        mockVideoServer.reset();

        // Verify they're gone
        listRes = await fetch('http://media:8080/v3/paths/list', {
            method: 'GET',
            headers: {
                'Authorization': 'Basic ' + Buffer.from('management:secret').toString('base64')
            }
        });
        listBody = await listRes.json();
        t.equal(listBody.itemCount, 0, 'Paths cleared after reset');
    } catch (err) {
        t.error(err, 'no error resetting mock server');
    }

    mockVideoServer.close();
    t.end();
});