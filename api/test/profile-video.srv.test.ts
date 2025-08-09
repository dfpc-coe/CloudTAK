import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()
let uuid = '123';

test('GET: api/profile/video', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            total: 0,
            items: []
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('POST: api/profile/video', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                url: 'https://example.com/video.mp4',
            }
        }, true);

        uuid = res.body.id;

        t.ok(res.body.created);
        t.ok(res.body.updated);
        res.body.created = time;
        res.body.updated = time;

        t.deepEquals(res.body, {
            id: uuid,
            created: time,
            updated: time,
            username: 'admin@example.com',
            url: 'https://example.com/video.mp4',
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/video', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/video', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        if (res.body.items.length > 0) {
            res.body.items[0].created = time;
            res.body.items[0].updated = time;
        }

        t.deepEquals(res.body, {
            total: 1,
            items: [{
                id: uuid,
                created: time,
                updated: time,
                username: 'admin@example.com',
                url: 'https://example.com/video.mp4',
            }]
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test(`GET: api/profile/video/${uuid}`, async (t) => {
    try {
        const res = await flight.fetch(`/api/profile/video/${uuid}`, {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        t.ok(res.body.created);
        t.ok(res.body.updated);
        res.body.created = time;
        res.body.updated = time;

        t.deepEquals(res.body, {
            id: uuid,
            created: time,
            updated: time,
            username: 'admin@example.com',
            url: 'https://example.com/video.mp4',
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test(`DELETE: api/profile/video/${uuid}`, async (t) => {
    try {
        const res = await flight.fetch(`/api/profile/video/${uuid}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Video Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
