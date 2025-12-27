import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

test('GET: api/basemap', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            collections: [],
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/basemap - Invalid URL', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'test',
            }
        }, true);

        assert.fail()
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Invalid URL provided","messages":[]}');
    }
});

test('POST: api/basemap - Invalid URL Protocol', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'ftp://test.com/test',
            }
        }, true);

        assert.fail()
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Only HTTP and HTTPS Protocols are supported","messages":[]}');
    }
});

test('POST: api/basemap - Invalid URL - No Variables', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'https://test.com/test',
            }
        }, true);

        assert.fail()
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Either XYZ, Quadkey variables OR ESRI FeatureServer/ImageServer must be used","messages":[]}');
    }
});

test('POST: api/basemap', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'https://test.com/test/{z}/{x}/{y}',
                sharing_enabled: false
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

test('GET: api/basemap/1/tiles', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1/tiles', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            tilejson: '3.0.0',
            version: '1.0.0',
            description: '',
            scheme: 'xyz',
            name: 'Test Basemap',
            type: 'raster',
            bounds: [ -180, -90, 180, 90 ],
            center: [ 0, 0 ],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 16,
            actions: { feature: [] },
            tiles: [ 'http://localhost:5001/api/basemap/1/tiles/{z}/{x}/{y}' ],
            vector_layers: [{ id: 'out', fields: {} }]
        })
    } catch (err) {
        assert.ifError(err)
    }
});

test('PATCH: api/basemap/1', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap2',
            }
        }, true);

        delete res.body.created;
        delete res.body.updated

        assert.deepEqual(res.body, {
            id: 1,
            name: 'Test Basemap2',
            actions: { feature: [] },
            url: 'https://test.com/test/{z}/{x}/{y}',
            overlay: false,
            iconset: '',
            title: 'callsign',
            username: 'admin@example.com',
            attribution: "",
            frequency: null,
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

test('PATCH: api/basemap/1 - Invalid URL', async () => {
    try {
        await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap',
                url: 'test',
            }
        }, true);

        assert.fail()
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Invalid URL provided","messages":[]}');
    }
});

test('DELETE: api/basemap/1', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Basemap Deleted'
        })
    } catch (err) {
        assert.ifError(err)
    }
});

test('DELETE: api/basemap/1 - Doesn\'t Exist', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            },
        }, false);

        assert.deepEqual(res.body, {
            status: 404,
            message:"Item Not Found",
            messages:[]
        })
    } catch (err) {
        assert.ifError(err)
    }
});

test('PATCH: api/basemap/1 - Doesn\'t Exist', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'Test Basemap2',
            }
        }, false);

        assert.deepEqual(res.body, {
            status: 404,
            message:"Item Not Found",
            messages:[]
        })
    } catch (err) {
        assert.ifError(err)
    }
});

flight.landing();
