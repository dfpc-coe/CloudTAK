import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

flight.connection();

test('GET: api/connection/1/video/lease', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/video/lease', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/video/lease', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/video/lease', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                name: 'TEST Lease'
            }
        }, false);

        assert.deepEqual(res.body, {
            status: 400,
            message: 'Media Integration is not configured',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT api/config', async () => {
    try {
        const res = await flight.fetch('/api/config', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                'media::url': 'https://video.example.com'
            }
        }, false);

        assert.deepEqual(res.body, {
            'media::url': 'https://video.example.com'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
