import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();

test('GET: /api/manifest.webmanifest', async () => {
    try {
        const res = await flight.fetch('/api/manifest.webmanifest', {
            method: 'GET'
        }, true);

        assert.equal(res.status, 200, 'http 200');
        assert.equal(res.body.name, 'Test Runner');
        assert.equal(res.body.short_name, 'Test Runner');
        assert.equal(res.body.display, 'standalone');
        assert.equal(res.body.start_url, '/');
        assert.ok(Array.isArray(res.body.icons), 'icons is array');
        assert.ok(res.body.icons.length > 0, 'has icons');

        // Check first icon structure
        assert.ok(res.body.icons[0].src);
        assert.ok(res.body.icons[0].sizes);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
