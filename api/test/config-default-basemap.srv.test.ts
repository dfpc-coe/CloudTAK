import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('Config: Default Basemap Flow - Get Default Config', async () => {
    try {
        const res = await flight.fetch('/api/config?keys=map::basemap', {
            method: 'GET',
            auth: { bearer: flight.token.admin }
        }, true);

       assert.equal(res.body['map::basemap'], undefined);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Default Basemap Flow - Create Basemap', async () => {
    try {
        const res = await flight.fetch('/api/basemap', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Default Basemap Test',
                url: 'https://test.com/default/{z}/{x}/{y}',
            }
        }, true);

        assert.ok(res.body.id, 'Basemap Created');
    } catch (err) {
        assert.ifError(err);
        return;
    }
});

test('Config: Default Basemap Flow - Create Default Basemap Config', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                'map::basemap': 1
            }
        }, true);

        assert.equal(res.body['map::basemap'], 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Default Basemap Flow - Fail Deleting Default Basemap', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: { bearer: flight.token.admin }
        }, false);

        assert.equal(res.status, 400);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'Cannot delete default basemap',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Default Basemap Flow - Unset Default Basemap', async () => {
    try {
        await flight.fetch('/api/config', {
            method: 'PUT',
            auth: { bearer: flight.token.admin },
            body: {
                'map::basemap': null
            }
        }, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Config: Default Basemap Flow - Sucessful Basemap Delete', async () => {
    try {
        const res = await flight.fetch('/api/basemap/1', {
            method: 'DELETE',
            auth: { bearer: flight.token.admin }
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Basemap Deleted'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
