import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('POST: api/basemap - Parent Overlay', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Parent Overlay',
                url: 'https://test.com/parent/{z}/{x}/{y}',
                protocol: 'zxy',
                overlay: true,
                sharing_enabled: false,
            },
        }, true);

        assert.equal(res.body.id, 1);
        assert.equal(res.body.parent, null);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/basemap - Parent Doesn\'t Exist', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Child Overlay',
                url: 'https://test.com/child/{z}/{x}/{y}',
                protocol: 'zxy',
                overlay: true,
                sharing_enabled: false,
                parent: 123,
            },
        }, true);

        assert.fail();
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Parent Basemap does not exist","messages":[]}');
    }
});

test('POST: api/basemap - Child Overlay', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Child Overlay',
                url: 'https://test.com/child/{z}/{x}/{y}',
                protocol: 'zxy',
                overlay: true,
                sharing_enabled: false,
                parent: 1,
            },
        }, true);

        assert.equal(res.body.id, 2);
        assert.equal(res.body.parent, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/basemap - Child of Child is Rejected', async () => {
    try {
        await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Grandchild Overlay',
                url: 'https://test.com/grandchild/{z}/{x}/{y}',
                protocol: 'zxy',
                overlay: true,
                sharing_enabled: false,
                parent: 2,
            },
        }, true);

        assert.fail();
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Basemaps can only be nested a single level deep","messages":[]}');
    }
});

test('GET: api/basemap/1 - Children are Returned', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, 1);
        assert.equal(res.body.parent, null);
        assert.equal(res.body.children.length, 1);
        assert.equal(res.body.children[0].id, 2);
        assert.equal(res.body.children[0].parent, 1);
        assert.equal(res.body.children[0].name, 'Child Overlay');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/2 - Child has no Children', async () => {
    try {
        const res = await flight.fetch('/api/basemap/2', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.id, 2);
        assert.equal(res.body.parent, 1);
        assert.deepEqual(res.body.children, []);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap - Children are Excluded from Listing', async () => {
    try {
        const res = await flight.fetch('/api/basemap?overlay=true', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items.length, 1);
        assert.equal(res.body.items[0].id, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/2 - Self Parent is Rejected', async () => {
    try {
        await flight.fetch('/api/basemap/2', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                parent: 2,
            },
        }, true);

        assert.fail();
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"A Basemap cannot be its own parent","messages":[]}');
    }
});

test('POST: api/basemap - Standalone Overlay', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Standalone Overlay',
                url: 'https://test.com/standalone/{z}/{x}/{y}',
                protocol: 'zxy',
                overlay: true,
                sharing_enabled: false,
            },
        }, true);

        assert.equal(res.body.id, 3);
        assert.equal(res.body.parent, null);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/3 - Parent with Parent is Rejected', async () => {
    try {
        await flight.fetch('/api/basemap/3', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                parent: 2,
            },
        }, true);

        assert.fail();
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Basemaps can only be nested a single level deep","messages":[]}');
    }
});

test('PATCH: api/basemap/1 - Parent with Children cannot become a Child', async () => {
    try {
        await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                parent: 3,
            },
        }, true);

        assert.fail();
    } catch (err) {
        assert.equal(String(err), 'AssertionError [ERR_ASSERTION]: {"status":400,"message":"Basemaps can only be nested a single level deep","messages":[]}');
    }
});

test('PATCH: api/basemap/3 - Adopt Parent', async () => {
    try {
        const res = await flight.fetch('/api/basemap/3', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                parent: 1,
            },
        }, true);

        assert.equal(res.body.parent, 1);

        const parent = await flight.fetch('/api/basemap/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(parent.body.children.map((c: { id: number }) => c.id), [2, 3]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/3 - Detach Parent', async () => {
    try {
        const res = await flight.fetch('/api/basemap/3', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                parent: null,
            },
        }, true);

        assert.equal(res.body.parent, null);

        const parent = await flight.fetch('/api/basemap/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(parent.body.children.map((c: { id: number }) => c.id), [2]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/basemap/1 - Children are Cascade Deleted', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Basemap Deleted',
        });

        const child = await flight.fetch('/api/basemap/2', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(child.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
