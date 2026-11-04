import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('POST: api/basemap - Server scoped basemap', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Server Basemap',
                scope: 'server',
                tilesize: 512,
                url: 'https://test.com/test/{z}/{x}/{y}',
                protocol: 'zxy',
            },
        }, true);

        assert.equal(res.body.id, 1);
        assert.equal(res.body.username, null);
        assert.equal(res.body.tilesize, 512);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/1 - Omitting scope keeps server scope', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Server Basemap Renamed',
            },
        }, true);

        assert.equal(res.body.name, 'Server Basemap Renamed');
        assert.equal(res.body.username, null);
        assert.equal(res.body.tilesize, 512);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/basemap/1 - Still server scoped', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.username, null);
        assert.equal(res.body.tilesize, 512);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/1 - Explicit user scope moves to editor', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                scope: 'user',
            },
        }, true);

        assert.equal(res.body.username, 'admin@example.com');
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/basemap/1 - Explicit server scope restores server', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                scope: 'server',
            },
        }, true);

        assert.equal(res.body.username, null);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
