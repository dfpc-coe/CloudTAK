import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

let token: string;

test('POST: api/basemap - Sharing Turned On Initially', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                sharing_enabled: true,
                url: 'https://test.com/test/{z}/{x}/{y}',
            }
        }, true);

        delete res.body.created;
        delete res.body.updated

        assert.ok(res.body.sharing_token)
        token = res.body.sharing_token;
        delete res.body.sharing_token;

        assert.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap',
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            iconset: '',
            attribution: "",
            frequency: null,
            title: 'callsign',
            username: 'admin@example.com',
            sharing_enabled: true,
            collection: null,
            tilesize: 256,
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            scheme: 'xyz',
            styles: [],
            type: 'raster'
        })
    } catch (err) {
        assert.ifError(err)
    }
});

test('GET: api/basemap/1/tiles - Ensure Access Without Token Doesn\'t', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
        }, false);

        assert.deepEqual(res.body, {
            status: 401,
            message: 'No Auth Present',
            messages: []
        });

    } catch (err) {
        assert.ifError(err)
    }
});

test('GET: api/basemap/1/tiles - Ensure Token Works', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, true);

        delete res.body.created;
        delete res.body.updated

        assert.deepEqual(res.body, {
            tilejson: '3.0.0',
            version: '1.0.0',
            name: 'Test Basemap',
            description: '',
            scheme: 'xyz',
            type: 'raster',
            bounds: [ -180, -90, 180, 90 ],
            center: [ 0, 0 ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 16,
            tiles: [ 'http://localhost:5001/api/basemap/1/tiles/{z}/{x}/{y}' ],
            vector_layers: [ { id: 'out', fields: {} } ],
            actions: { feature: [] }
        })
    } catch (err) {
        assert.ifError(err)
    }
});

test('PATCH: api/basemap/1 - Turn off Sharing', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                sharing_enabled: false,
            }
        }, true);

        delete res.body.created;
        delete res.body.updated

        assert.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap',
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            iconset: '',
            attribution: "",
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
            scheme: 'xyz',
            styles: [],
            type: 'raster'
        })
    } catch (err) {
        assert.ifError(err)
    }
});

test('GET: api/basemap/1/tiles - Ensure Token Is Now Disabled', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'Sharing for Test Basemap is disabled',
            messages: []
        })
    } catch (err) {
        assert.ifError(err)
    }
});

test('PATCH: api/basemap/1 - Turn on Sharing', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                sharing_enabled: true,
            }
        }, true);

        delete res.body.created;
        delete res.body.updated

        assert.ok(res.body.sharing_token)
        delete res.body.sharing_token;

        assert.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap',
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            iconset: '',
            attribution: "",
            frequency: null,
            title: 'callsign',
            username: 'admin@example.com',
            sharing_enabled: true,
            collection: null,
            tilesize: 256,
            minzoom: 0,
            maxzoom: 16,
            format: 'png',
            scheme: 'xyz',
            styles: [],
            type: 'raster'
        })
    } catch (err) {
        assert.ifError(err)
    }
});

test('GET: api/basemap/1/tiles - Ensure Old Token is unusable', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'You don\'t have permission to access this resource',
            messages: []
        })
    } catch (err) {
        assert.ifError(err)
    }
});

flight.landing();
