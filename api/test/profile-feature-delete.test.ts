import test from 'tape';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()

test('PUT: api/profile/feature - Path', async (t) => {
    try {
        await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: '123-path-1',
                type: 'Feature',
                path: '/path1/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    callsign: 'Test Callsign',
                    archived: true,
                    center: [123.3223, 123.0002],
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123]
                }
            }
        }, true);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PUT: api/profile/feature - Path 2', async (t) => {
    try {
        await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: '123-path2',
                type: 'Feature',
                path: '/path2/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    callsign: 'Test Callsign',
                    archived: true,
                    center: [123.3223, 123.0002],
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123]
                }
            }
        }, true);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('PUT: api/profile/feature - No Path', async (t) => {
    try {
        await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: '123-no-path',
                type: 'Feature',
                path: '/Other Path/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    callsign: 'Test Callsign',
                    archived: true,
                    center: [123.3223, 123.0002],
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123]
                }
            }
        }, true);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/feature', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body.total, 3);

        t.equals(res.body.total, 3);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/profile/feature?path=fake', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/feature?path=fake', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Features Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/feature', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body.total, 3)

        t.equals(res.body.total, 3);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/profile/feature?path=/path1/', async (t) => {
    try {
        const res = await flight.fetch(`/api/profile/feature?path=${encodeURIComponent('/path1/')}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Features Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/feature', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body.items.map((i: { id: string }) => { return i.id }).sort(), ['123-no-path', '123-path2']);

        t.equals(res.body.total, 2);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/profile/feature', async (t) => {
    try {
        const res = await flight.fetch(`/api/profile/feature`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Features Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/feature', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.equals(res.body.total, 0);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/feature/123-no-path', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/feature/123-no-path', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            id: '123-no-path',
            type: 'Feature',
            path: '/Other Path/',
            properties: {
                type: 'a-f-g',
                how: 'm-g',
                time: time,
                start: time,
                stale: time,
                callsign: 'Test Callsign',
                archived: true,
                center: [123.3223, 123.0002],
            },
            geometry: {
                type: 'Point',
                coordinates: [123.3223, 123.0002, 123]
            }
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('DELETE: api/profile/feature/123-no-path?permanent=true', async (t) => {
    try {
        const res = await flight.fetch(`/api/profile/feature/123-no-path?permanent=true`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        t.deepEquals(res.body, {
            status: 200,
            message: 'Feature Deleted'
        });
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

test('GET: api/profile/feature/123-no-path', async (t) => {
    try {
        const res = await flight.fetch('/api/profile/feature/123-no-path', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        t.deepEquals(res.status, 404);
    } catch (err) {
        t.error(err, 'no error');
    }

    t.end();
});

flight.landing();
