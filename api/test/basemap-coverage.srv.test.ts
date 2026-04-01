import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.user({ username: 'user', admin: false });

test('GET: api/basemap - Empty list', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.deepEqual(res.body, {
        total: 0,
        collections: [],
        items: []
    });
});

test('POST: api/basemap - Create basemap with bounds and center', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Bounded Basemap',
            url: 'https://test.com/tiles/{z}/{x}/{y}',
            sharing_enabled: false,
            bounds: [-105, 39, -104, 40],
            center: [-104.5, 39.5],
        }
    }, true);

    delete res.body.created;
    delete res.body.updated;

    assert.equal(res.body.id, 1);
    assert.equal(res.body.name, 'Bounded Basemap');
    assert.ok(Array.isArray(res.body.bounds));
    assert.ok(Array.isArray(res.body.center));
});

test('POST: api/basemap - Create overlay basemap', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Overlay Basemap',
            url: 'https://test.com/overlay/{z}/{x}/{y}',
            sharing_enabled: false,
            overlay: true,
        }
    }, true);

    assert.equal(res.body.overlay, true);
});

test('POST: api/basemap - Create hidden basemap', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Hidden Basemap',
            url: 'https://test.com/hidden/{z}/{x}/{y}',
            sharing_enabled: false,
            hidden: true,
        }
    }, true);

    assert.equal(res.body.hidden, true);
});

test('POST: api/basemap - Create basemap in collection', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Collection Basemap',
            url: 'https://test.com/col/{z}/{x}/{y}',
            sharing_enabled: false,
            collection: 'test-collection',
        }
    }, true);

    assert.equal(res.body.collection, 'test-collection');
});

test('POST: api/basemap - Create server-scoped basemap (admin)', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Server Basemap',
            url: 'https://test.com/server/{z}/{x}/{y}',
            sharing_enabled: false,
            scope: 'server',
        }
    }, true);

    assert.equal(res.body.username, null);
});

test('POST: api/basemap - Non-admin cannot create server-scoped basemap', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.user },
            body: {
                name: 'Should Fail',
                url: 'https://test.com/fail/{z}/{x}/{y}',
                scope: 'server',
            }
        }, true);

        assert.fail();
    } catch (err) {
        assert.ok(String(err).includes('Only Server Admins can create Server scoped basemaps'));
    }
});

test('POST: api/basemap - Snapping on non-vector type fails', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Snap Fail',
                url: 'https://test.com/snap/{z}/{x}/{y}',
                type: 'raster',
                snapping_enabled: true,
                snapping_layer: 'test',
            }
        }, true);

        assert.fail();
    } catch (err) {
        assert.ok(String(err).includes('Snapping can only be enabled on Vector basemaps'));
    }
});

test('POST: api/basemap - Snapping without snapping_layer fails', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Snap No Layer',
                url: 'https://test.com/snap2/{z}/{x}/{y}',
                type: 'vector',
                format: 'mvt',
                snapping_enabled: true,
            }
        }, true);

        assert.fail();
    } catch (err) {
        assert.ok(String(err).includes('A snapping_layer must be provided when enabling snapping'));
    }
});

test('POST: api/basemap - Snapping on non-S3 hosted fails', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Snap Non-S3',
                url: 'https://external.com/tiles/{z}/{x}/{y}',
                type: 'vector',
                format: 'mvt',
                snapping_enabled: true,
                snapping_layer: 'buildings',
            }
        }, true);

        assert.fail();
    } catch (err) {
        assert.ok(String(err).includes('Snapping can only be enabled on S3 hosted Basemaps'));
    }
});

test('POST: api/basemap - Create basemap with sharing enabled', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            name: 'Shared Basemap',
            url: 'https://test.com/shared/{z}/{x}/{y}',
            sharing_enabled: true,
        }
    }, true);

    assert.ok(res.body.sharing_token);
    assert.equal(res.body.sharing_enabled, true);
});

test('GET: api/basemap - Filter by overlay', async () => {
    const res = await flight.fetch('/api/basemap?overlay=true', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.ok(res.body.total >= 1);
    for (const item of res.body.items) {
        assert.equal(item.overlay, true);
    }
});

test('GET: api/basemap - Filter by type', async () => {
    const res = await flight.fetch('/api/basemap?type=raster', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    for (const item of res.body.items) {
        assert.equal(item.type, 'raster');
    }
});

test('GET: api/basemap - Filter by collection', async () => {
    const res = await flight.fetch('/api/basemap?collection=test-collection', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.ok(res.body.total >= 1);
    for (const item of res.body.items) {
        assert.equal(item.collection, 'test-collection');
    }
});

test('GET: api/basemap - Filter by hidden=all', async () => {
    const res = await flight.fetch('/api/basemap?hidden=all', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.ok(res.body.total >= 1);
});

test('GET: api/basemap - Filter by scope=server', async () => {
    const res = await flight.fetch('/api/basemap?scope=server', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    for (const item of res.body.items) {
        assert.equal(item.username, null);
    }
});

test('GET: api/basemap - Filter by scope=user', async () => {
    const res = await flight.fetch('/api/basemap?scope=user', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    for (const item of res.body.items) {
        assert.ok(item.username);
    }
});

test('GET: api/basemap - Impersonate (admin lists all)', async () => {
    const res = await flight.fetch('/api/basemap?impersonate=true', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.ok(res.body.total >= 1);
});

test('GET: api/basemap - Impersonate specific user', async () => {
    const res = await flight.fetch('/api/basemap?impersonate=admin@example.com', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    for (const item of res.body.items) {
        assert.equal(item.username, 'admin@example.com');
    }
});

test('GET: api/basemap - Impersonate with collection filter', async () => {
    const res = await flight.fetch('/api/basemap?impersonate=true&collection=test-collection', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    for (const item of res.body.items) {
        assert.equal(item.collection, 'test-collection');
    }
});

test('GET: api/basemap - Normal user only sees own + server basemaps', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'GET',
        auth: { bearer: flight.token.user }
    }, true);

    for (const item of res.body.items) {
        assert.ok(item.username === null || item.username === 'user@example.com');
    }
});

test('GET: api/basemap/1 - JSON format', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.equal(res.body.id, 1);
    assert.equal(res.body.name, 'Bounded Basemap');
    assert.ok(res.body.actions);
});

test('PATCH: api/basemap/1 - Enable sharing for XML test', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: { sharing_enabled: true }
    }, true);

    assert.equal(res.body.sharing_enabled, true);
});

test('GET: api/basemap/1 - XML format', async () => {
    const res = await flight.fetch('/api/basemap/1?format=xml', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, { json: false });

    assert.ok(typeof res.body === 'string');
    assert.ok(res.body.includes('customMapSource'));
    assert.ok(res.body.includes('Bounded Basemap'));
});

test('GET: api/basemap/1 - XML format with download', async () => {
    const res = await flight.fetch('/api/basemap/1?format=xml&download=true', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, { json: false });

    assert.ok(typeof res.body === 'string');
    assert.ok(res.headers.get('content-disposition')?.includes('attachment'));
});

test('PATCH: api/basemap/1 - Update bounds and center', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            bounds: [-106, 38, -103, 41],
            center: [-104.5, 39.5],
        }
    }, true);

    assert.ok(Array.isArray(res.body.bounds));
    assert.ok(Array.isArray(res.body.center));
});

test('PATCH: api/basemap/5 - Admin changes server-scoped basemap to user scope', async () => {
    const res = await flight.fetch('/api/basemap/5', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            scope: 'user',
        }
    }, true);

    assert.equal(res.body.username, 'admin@example.com');
});

test('PATCH: api/basemap/5 - Admin changes basemap back to server scope', async () => {
    const res = await flight.fetch('/api/basemap/5', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            scope: 'server',
        }
    }, true);

    assert.equal(res.body.username, null);
});

test('PATCH: api/basemap/5 - Non-admin cannot edit server resource', async () => {
    const res = await flight.fetch('/api/basemap/5', {
        method: 'PATCH',
        auth: { bearer: flight.token.user },
        body: { name: 'Should Fail' }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('Only System Admin'));
});

test('PATCH: api/basemap/1 - Snapping on non-vector fails', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            snapping_enabled: true,
            snapping_layer: 'test',
        }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('Snapping can only be enabled on Vector basemaps'));
});

test('PATCH: api/basemap/1 - Snapping without snapping_layer in PATCH fails', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            type: 'vector',
            snapping_enabled: true,
        }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('A snapping_layer must be provided'));
});

test('PATCH: api/basemap/1 - Snapping on non-S3 hosted in PATCH fails', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            type: 'vector',
            snapping_enabled: true,
            snapping_layer: 'buildings',
        }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('Snapping can only be enabled on S3 hosted Basemaps'));
});

test('PATCH: api/basemap/1 - Update URL triggers validation', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: {
            url: 'https://new.example.com/tiles/{z}/{x}/{y}',
        }
    }, true);

    assert.equal(res.body.url, 'https://new.example.com/tiles/{z}/{x}/{y}');
});

test('PATCH: api/basemap/1 - Enable then disable sharing', async () => {
    const res1 = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: { sharing_enabled: true }
    }, true);

    assert.equal(res1.body.sharing_enabled, true);
    assert.ok(res1.body.sharing_token);

    const res2 = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.admin },
        body: { sharing_enabled: false }
    }, true);

    assert.equal(res2.body.sharing_enabled, false);
    assert.equal(res2.body.sharing_token, null);
});

test('POST: api/basemap/1/feature - ZXY protocol does not support feature query', async () => {
    const res = await flight.fetch('/api/basemap/1/feature', {
        method: 'POST',
        auth: { bearer: flight.token.admin },
        body: {
            polygon: {
                type: 'Polygon',
                coordinates: [[[-105, 39], [-104, 39], [-104, 40], [-105, 40], [-105, 39]]]
            }
        }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('Feature querying is not supported'));
});

test('GET: api/basemap/1/feature/123 - ZXY protocol does not support feature fetch', async () => {
    const res = await flight.fetch('/api/basemap/1/feature/123', {
        method: 'GET',
        auth: { bearer: flight.token.admin }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('Feature fetching is not supported'));
});

test('DELETE: api/basemap/5 - Non-admin cannot delete server-scoped basemap', async () => {
    const res = await flight.fetch('/api/basemap/5', {
        method: 'DELETE',
        auth: { bearer: flight.token.user },
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('Only System Admin'));
});

test('PUT: api/config - Set basemap 1 as default', async () => {
    const res = await flight.fetch('/api/config', {
        method: 'PUT',
        auth: { bearer: flight.token.admin },
        body: { 'map::basemap': 1 }
    }, true);

    assert.equal(res.body['map::basemap'], 1);
});

test('DELETE: api/basemap/1 - Cannot delete default basemap', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'DELETE',
        auth: { bearer: flight.token.admin }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('Cannot delete default basemap'));
});

test('PUT: api/config - Unset default basemap', async () => {
    await flight.fetch('/api/config', {
        method: 'PUT',
        auth: { bearer: flight.token.admin },
        body: { 'map::basemap': null }
    }, true);
});

test('POST: api/basemap - User creates own basemap', async () => {
    const res = await flight.fetch('/api/basemap', {
        method: 'POST',
        auth: { bearer: flight.token.user },
        body: {
            name: 'User Basemap',
            url: 'https://test.com/user/{z}/{x}/{y}',
            sharing_enabled: false,
        }
    }, true);

    assert.equal(res.body.username, 'user@example.com');
});

test('GET: api/basemap/:id - User cannot access another user\'s basemap', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'GET',
        auth: { bearer: flight.token.user }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('permission'));
});

test('PATCH: api/basemap/1 - User cannot update another user\'s basemap', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'PATCH',
        auth: { bearer: flight.token.user },
        body: { name: 'Hijacked' }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('permission'));
});

test('DELETE: api/basemap/1 - User cannot delete another user\'s basemap', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'DELETE',
        auth: { bearer: flight.token.user }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('permission'));
});

test('PATCH: api/basemap/7 - Non-admin cannot change scope to server', async () => {
    const res = await flight.fetch('/api/basemap/7', {
        method: 'PATCH',
        auth: { bearer: flight.token.user },
        body: { scope: 'server' }
    }, false);

    assert.equal(res.body.status, 400);
    assert.ok(res.body.message.includes('Only Server Admins'));
});

test('DELETE: api/basemap/7 - User deletes own basemap', async () => {
    const res = await flight.fetch('/api/basemap/7', {
        method: 'DELETE',
        auth: { bearer: flight.token.user }
    }, true);

    assert.equal(res.body.status, 200);
});

test('DELETE: api/basemap/6 - Shared Basemap', async () => {
    const res = await flight.fetch('/api/basemap/6', {
        method: 'DELETE',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.equal(res.body.status, 200);
});

test('DELETE: api/basemap/5 - Server Basemap', async () => {
    const res = await flight.fetch('/api/basemap/5', {
        method: 'DELETE',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.equal(res.body.status, 200);
});

test('DELETE: api/basemap/4 - Collection Basemap', async () => {
    const res = await flight.fetch('/api/basemap/4', {
        method: 'DELETE',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.equal(res.body.status, 200);
});

test('DELETE: api/basemap/3 - Hidden Basemap', async () => {
    const res = await flight.fetch('/api/basemap/3', {
        method: 'DELETE',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.equal(res.body.status, 200);
});

test('DELETE: api/basemap/2 - Overlay Basemap', async () => {
    const res = await flight.fetch('/api/basemap/2', {
        method: 'DELETE',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.equal(res.body.status, 200);
});

test('DELETE: api/basemap/1 - Bounded Basemap', async () => {
    const res = await flight.fetch('/api/basemap/1', {
        method: 'DELETE',
        auth: { bearer: flight.token.admin }
    }, true);

    assert.equal(res.body.status, 200);
});

flight.landing();
