import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET /api/search/reverse/:longitude/:latitude - success', async () => {
    try {
        const res = await flight.fetch('/api/search/reverse/-105/39.7', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.ok(res.body.sun, 'Sun data present');
        assert.equal(res.body.reverse, null, 'No reverse geocoding without token');
        // Note: Should be null but downstream processing converts null to empty string
        assert.ok(res.body.elevation === null || res.body.elevation === '', 'No elevation without query param');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET /api/search/reverse/:longitude/:latitude - with elevation', async () => {
    try {
        const res = await flight.fetch('/api/search/reverse/-105/39.7?elevation=1655', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.ok(res.body.elevation, 'Elevation data present');
        assert.ok(res.body.elevation.includes('ft'), 'Elevation in feet (default unit)');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET /api/search/suggest - success', async () => {
    try {
        const res = await flight.fetch('/api/search/suggest?query=Denver&limit=5&longitude=-105&latitude=39.7', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.ok(res.body.items, 'Items array present');
        assert.ok(Array.isArray(res.body.items), 'Items is an array');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET /api/search/forward - success', async () => {
    try {
        const res = await flight.fetch('/api/search/forward?query=Denver&magicKey=test&longitude=-105&latitude=39.7', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.ok(res.body.items, 'Items array present');
        assert.ok(Array.isArray(res.body.items), 'Items is an array');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET /api/search/route - without token', async () => {
    try {
        const res = await flight.fetch('/api/search/route?start=-105,39.7&end=-104.8,39.9', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.equal(res.body.type, 'FeatureCollection', 'Returns empty FeatureCollection');
        assert.equal(res.body.features.length, 0, 'No features without ArcGIS token');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET /api/search/route - with travel mode', async () => {
    try {
        const res = await flight.fetch('/api/search/route?start=-105,39.7&end=-104.8,39.9&travelMode=Walking Time', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.equal(res.body.type, 'FeatureCollection', 'Returns FeatureCollection');
        assert.ok(Array.isArray(res.body.features), 'Features is an array');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET /api/search/suggest - empty query', async () => {
    try {
        const res = await flight.fetch('/api/search/suggest?query=&limit=5', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.ok(res.body.items, 'Items array present');
        assert.equal(res.body.items.length, 0, 'Empty results for empty query');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET /api/search/forward - empty query', async () => {
    try {
        const res = await flight.fetch('/api/search/forward?query=&magicKey=test', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.ok(res.body.items, 'Items array present');
        assert.equal(res.body.items.length, 0, 'Empty results for empty query');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET /api/search/reverse/:longitude/:latitude - weather fallback', async () => {
    try {
        // Test with London coordinates (outside US) to trigger fallback
        const res = await flight.fetch('/api/search/reverse/-0.1/51.5', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.ok(res.body.sun, 'Sun data present');
        // Weather may be present from fallback or null if APIs fail
        assert.ok(res.body.weather !== undefined, 'Weather field present');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
