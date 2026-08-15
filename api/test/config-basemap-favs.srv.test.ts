import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('Config: Basemap Favs Flow - Get Default Config', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=map::basemap::favs', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body['map::basemap::favs'], undefined);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Basemap Favs Flow - Create Basemap', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Basemap Favs Test',
                url: 'https://test.com/favs/{z}/{x}/{y}',
                protocol: 'zxy',
                scope: 'server',
            },
        }, true);

        assert.ok(res.body.id, 'Basemap Created');
    } catch (err) {
        assert.ifError(err);
        return;
    }
});

test('Config: Basemap Favs Flow - Fail on Non-Existent Basemap', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                'map::basemap::favs': [{
                    id: 123456,
                    name: 'Missing Basemap',
                    image: 'iVBORw0KGgo=',
                }],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Favourite Basemap (123456) does not exist');
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Basemap Favs Flow - Fail on More Than 3 Favs', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                'map::basemap::favs': [1, 1, 1, 1].map((id, i) => ({
                    id,
                    name: `Basemap Favs Test ${i}`,
                    image: 'iVBORw0KGgo=',
                })),
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Basemap Favs Flow - Set Favs', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                'map::basemap::favs': [{
                    id: 1,
                    name: 'Basemap Favs Test',
                    image: 'iVBORw0KGgo=',
                }],
            },
        }, true);

        assert.deepEqual(res.body['map::basemap::favs'], [{
            id: 1,
            name: 'Basemap Favs Test',
            image: 'iVBORw0KGgo=',
        }]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Basemap Favs Flow - Get Favs', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=map::basemap::favs', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body['map::basemap::favs'], [{
            id: 1,
            name: 'Basemap Favs Test',
            image: 'iVBORw0KGgo=',
        }]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Basemap Favs Flow - Fail Deleting Favourite Basemap', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, false);

        assert.equal(res.status, 400);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'Cannot delete favourite basemap',
            messages: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Basemap Favs Flow - Unset Favs', async () => {
    try {
        await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                'map::basemap::favs': null,
            },
        }, true);

        const res = await flight.fetch('/api/config?keys=map::basemap::favs', {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.equal(res.body['map::basemap::favs'], undefined);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Basemap Favs Flow - Successful Basemap Delete', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Basemap Deleted',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
