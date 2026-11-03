import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

let token: string;

test('POST: api/basemap - Sharing Turned On Initially', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Test Basemap',
                sharing_enabled: true,
                url: 'https://test.com/test/{z}/{x}/{y}',
                protocol: 'zxy',
            },
        }, true);

        delete res.body.created;
        delete res.body.updated;

        assert.ok(res.body.sharing_token);
        token = res.body.sharing_token;
        delete res.body.sharing_token;

        assert.deepEqual(res.body, {
            id: 1,
            parent: null,
            name: 'Test Basemap',
            hidden: false,
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            tilejson: null,
            iconset: null,
            attribution: null,
            frequency: null,
            title: 'callsign',
            username: 'admin@example.com',
            sharing_enabled: true,
            collection: null,
            tilesize: 256,
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            protocol: 'zxy',
            scheme: 'xyz',
            styles: [],
            type: 'raster',
            snapping_enabled: false,
            snapping_layer: null,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1 - Ensure Sharing Token Reads Basemap Config', async () => {
    try {
        const res = await flight.fetch(`/api/basemap/1?token=${token}`, {
            method: 'GET',
        }, true);

        assert.equal(res.body.id, 1);
        assert.equal(res.body.name, 'Test Basemap');
        assert.equal(res.body.url, 'https://test.com/test/{z}/{x}/{y}');
        assert.equal(res.body.protocol, 'zxy');
        assert.equal(res.body.sharing_enabled, true);
        assert.equal(res.body.sharing_token, token);
        assert.deepEqual(res.body.children, []);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/1 - Turn off Sharing', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                sharing_enabled: false,
            },
        }, true);

        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            parent: null,
            name: 'Test Basemap',
            hidden: false,
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            tilejson: null,
            iconset: null,
            attribution: null,
            frequency: null,
            title: 'callsign',
            username: 'admin@example.com',
            sharing_enabled: false,
            sharing_token: null,
            collection: null,
            tilesize: 256,
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            protocol: 'zxy',
            scheme: 'xyz',
            styles: [],
            type: 'raster',
            snapping_enabled: false,
            snapping_layer: null,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1 - Ensure Sharing Token Is Now Disabled', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'GET',
            auth: {
                bearer: token,
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'Sharing for Test Basemap is disabled',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/1 - Turn on Sharing', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                sharing_enabled: true,
            },
        }, true);

        delete res.body.created;
        delete res.body.updated;

        assert.ok(res.body.sharing_token);
        delete res.body.sharing_token;

        assert.deepEqual(res.body, {
            id: 1,
            parent: null,
            name: 'Test Basemap',
            hidden: false,
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            tilejson: null,
            iconset: null,
            attribution: null,
            frequency: null,
            title: 'callsign',
            username: 'admin@example.com',
            sharing_enabled: true,
            collection: null,
            tilesize: 256,
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            protocol: 'zxy',
            scheme: 'xyz',
            styles: [],
            type: 'raster',
            snapping_enabled: false,
            snapping_layer: null,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1 - Ensure Old Sharing Token is unusable', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'GET',
            auth: {
                bearer: token,
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'You don\'t have permission to access this resource',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
