import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

// Minimal 1x1 transparent PNG encoded as a data URL for logo tests
const TEST_LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.server('admin@example.com', 'password123');

test('GET: /api/manifest.webmanifest - no logo configured', async () => {
    try {
        const res = await flight.fetch('/api/manifest.webmanifest', {
            method: 'GET',
        }, true);

        assert.equal(res.status, 200, 'http 200');
        assert.equal(res.body.name, 'Test Server');
        assert.equal(res.body.short_name, 'Test Server');
        assert.equal(res.body.display, 'standalone');
        assert.equal(res.body.start_url, '/');
        assert.ok(Array.isArray(res.body.icons), 'icons is array');
        assert.equal(res.body.icons.length, 0, 'no icons when logo not configured');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: /api/config - set login logo', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: { 'login::logo': TEST_LOGO },
        }, false);

        assert.equal(res.status, 200, 'http 200');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /api/manifest.webmanifest - logo configured', async () => {
    try {
        const res = await flight.fetch('/api/manifest.webmanifest', {
            method: 'GET',
        }, true);

        assert.equal(res.status, 200, 'http 200');
        assert.ok(Array.isArray(res.body.icons), 'icons is array');
        assert.equal(res.body.icons.length, 2, 'two icons (192 and 512)');

        const sizes = res.body.icons.map((i: { sizes: string }) => i.sizes);
        assert.ok(sizes.includes('192x192'), 'has 192x192 icon');
        assert.ok(sizes.includes('512x512'), 'has 512x512 icon');

        for (const icon of res.body.icons) {
            assert.equal(icon.type, 'image/png');
            assert.match(icon.src, /^\/api\/manifest\.webmanifest\/logos\/\d+$/);
        }
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /api/manifest.webmanifest/logos/192', async () => {
    try {
        const res = await flight.fetch('/api/manifest.webmanifest/logos/192', {
            method: 'GET',
        }, { verify: false, json: false, binary: true });

        assert.equal(res.status, 200, 'http 200');
        assert.equal(res.headers.get('content-type'), 'image/png', 'content-type is image/png');
        assert.ok(res.body.byteLength > 0, 'response has image data');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /api/manifest.webmanifest/logos/512', async () => {
    try {
        const res = await flight.fetch('/api/manifest.webmanifest/logos/512', {
            method: 'GET',
        }, { verify: false, json: false, binary: true });

        assert.equal(res.status, 200, 'http 200');
        assert.equal(res.headers.get('content-type'), 'image/png', 'content-type is image/png');
        assert.ok(res.body.byteLength > 0, 'response has image data');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: /api/manifest.webmanifest/logos/999 - unknown size', async () => {
    try {
        const res = await flight.fetch('/api/manifest.webmanifest/logos/999', {
            method: 'GET',
        }, false);

        assert.equal(res.status, 404, 'http 404');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
