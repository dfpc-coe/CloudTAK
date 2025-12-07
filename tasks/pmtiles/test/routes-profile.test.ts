import test from 'tape';
import jwt from 'jsonwebtoken';
import http from 'http';
import type { AddressInfo } from 'net';

// Set env vars before importing app
process.env.SigningSecret = 'test-secret';
process.env.ASSET_BUCKET = 'test-bucket';

let app: any;
let server: http.Server;

function getAddress(): string {
    const addr = server.address() as AddressInfo;
    return `http://localhost:${addr.port}`;
}

test('Setup', async (t) => {
    try {
        const mod = await import('../src/index.js');
        app = mod.app;
        
        server = http.createServer(app);
        await new Promise<void>((resolve) => {
            server.listen(0, () => {
                resolve();
            });
        });
        t.pass('Server started');
    } catch (err) {
        t.error(err, 'Failed to start server');
    }
    t.end();
});

test('GET /tiles/profile/:username/:file - Missing Token', async (t) => {
    try {
        const res = await fetch(`${getAddress()}/tiles/profile/user@example.com/map`);
        t.equal(res.status, 400, 'Returns 400 (Validation Error)');
        const body = await res.json();
        t.match(body.message, /Validation Error/, 'Error message matches');
    } catch (err) {
        t.error(err);
    }
    t.end();
});

test('GET /tiles/profile/:username/:file - Unauthorized (Wrong User)', async (t) => {
    try {
        const token = jwt.sign({ email: 'other@example.com', access: 'profile' }, process.env.SigningSecret!);
        const res = await fetch(`${getAddress()}/tiles/profile/user@example.com/map?token=${token}`);
        t.equal(res.status, 401, 'Returns 401');
        const body = await res.json();
        t.match(body.message, /Unauthorized Access/, 'Error message matches');
    } catch (err) {
        t.error(err);
    }
    t.end();
});

test('GET /tiles/profile/:username/:file - Unauthorized (Wrong Access)', async (t) => {
    try {
        const token = jwt.sign({ email: 'user@example.com', access: 'other' }, process.env.SigningSecret!);
        const res = await fetch(`${getAddress()}/tiles/profile/user@example.com/map?token=${token}`);
        t.equal(res.status, 401, 'Returns 401');
        const body = await res.json();
        t.match(body.message, /Unauthorized Access/, 'Error message matches');
    } catch (err) {
        t.error(err);
    }
    t.end();
});

test('GET /tiles/profile/:username/:file - Success (Auth passes, S3 fails)', async (t) => {
    try {
        const token = jwt.sign({ email: 'user@example.com', access: 'profile' }, process.env.SigningSecret!);
        const res = await fetch(`${getAddress()}/tiles/profile/user@example.com/map?token=${token}`);
        
        // We expect a 500 or similar because S3 is not mocked and will fail
        // But getting past 401 means auth worked
        t.notEqual(res.status, 401, 'Should not be 401');
    } catch (err) {
        t.error(err);
    }
    t.end();
});

test('GET /tiles/profile/:username/:file/query - Missing Token', async (t) => {
    try {
        const res = await fetch(`${getAddress()}/tiles/profile/user@example.com/map/query`);
        t.equal(res.status, 400, 'Returns 400 (Validation Error)');
    } catch (err) {
        t.error(err);
    }
    t.end();
});

test('GET /tiles/profile/:username/:file/tiles/:z/:x/:y.:ext - Missing Token', async (t) => {
    try {
        const res = await fetch(`${getAddress()}/tiles/profile/user@example.com/map/tiles/0/0/0.mvt`);
        t.equal(res.status, 400, 'Returns 400 (Validation Error)');
    } catch (err) {
        t.error(err);
    }
    t.end();
});

test('Teardown', async (t) => {
    if (server) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
            server.close(() => {
                resolve();
            });
        });
        t.pass('Server stopped');
    }
    t.end();
    process.exit(0);
});
