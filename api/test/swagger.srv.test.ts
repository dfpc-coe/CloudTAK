import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/swagger', async () => {
    try {
        const res = await flight.fetch('/api/swagger', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(res.body.info);
        assert.equal(res.body.info.title, 'CloudTAK API');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/openapi - operation level security', async () => {
    try {
        const res = await flight.fetch('/api/openapi', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body.security, [{ bearerAuth: [] }]);
        assert.ok(res.body.components.securitySchemes.layerAuth);
        assert.ok(res.body.components.securitySchemes.connectionAuth);
        assert.deepEqual(res.body.paths['/api/core/device'].get.security, [
            { layerAuth: ['device:read'] },
            { connectionAuth: ['device:read'] },
            { bearerAuth: [] },
        ]);

        assert.deepEqual(res.body.paths['/api/search/forward'].get.security, [
            { layerAuth: ['search:read'] },
            { bearerAuth: [] },
        ]);
        assert.deepEqual(res.body.paths['/api/search/reverse/{:longitude}/{:latitude}'].get.security, [
            { layerAuth: ['search:read'] },
            { bearerAuth: [] },
        ]);
        assert.deepEqual(res.body.paths['/api/search/suggest'].get.security, [
            { layerAuth: ['search:read'] },
            { bearerAuth: [] },
        ]);

        assert.deepEqual(res.body.paths['/api/config'].put.security, [{ bearerAuth: ['admin'] }]);
        assert.deepEqual(res.body.paths['/api/login'].post.security, []);
        assert.deepEqual(res.body.paths['/api/iconset/{:iconset}'].get.security, [
            { bearerAuth: [] },
            { bearerQueryAuth: [] },
        ]);
        assert.deepEqual(res.body.paths['/api/layer/{:layerid}/cot'].post.security, [{ layerAuth: [] }]);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
