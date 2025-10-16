import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

let token: string;

test('POST: api/basemap - Sharing Turned On Initially', async (t) => {
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

        t.ok(res.body.sharing_token)
        token = res.body.sharing_token;
        delete res.body.sharing_token;

        t.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap',
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            attribution: "",
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
        t.error(err)
    }

    t.end();
});

test('GET: api/basemap/1/tiles - Ensure Access Without Token Doesn\'t', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
        }, false);

        t.deepEquals(res.body, {
            status: 401,
            message: 'No Auth Present',
            messages: []
        });

    } catch (err) {
        t.error(err)
    }

    t.end();
});

test('GET: api/basemap/1/tiles - Ensure Token Works', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, true);

        delete res.body.created;
        delete res.body.updated

        t.deepEqual(res.body, {
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
        t.error(err)
    }

    t.end();
});

test('PATCH: api/basemap/1 - Turn off Sharing', async (t) => {
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

        t.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap',
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            attribution: "",
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
        t.error(err)
    }

    t.end();
});

test('GET: api/basemap/1/tiles - Ensure Token Is Now Disabled', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, false);

        t.deepEqual(res.body, {
            status: 400,
            message: 'Sharing for Test Basemap is disabled',
            messages: []
        })
    } catch (err) {
        t.error(err)
    }

    t.end();
});

test('PATCH: api/basemap/1 - Turn on Sharing', async (t) => {
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

        t.ok(res.body.sharing_token)
        delete res.body.sharing_token;

        t.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap',
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            attribution: "",
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
        t.error(err)
    }

    t.end();
});

test('GET: api/basemap/1/tiles - Ensure Old Token is unusable', async (t) => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: token
            },
        }, false);

        t.deepEqual(res.body, {
            status: 400,
            message: 'You don\'t have permission to access this resource',
            messages: []
        })
    } catch (err) {
        t.error(err)
    }

    t.end();
});

flight.landing();
