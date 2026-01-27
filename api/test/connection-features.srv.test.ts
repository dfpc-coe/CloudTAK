import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.connection();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()

test('GET: api/connection/1/feature', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature', {
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

test('PUT: api/connection/1/feature', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: 'my-feature-id',
                type: 'Feature',
                path: '/Test Features/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    callsign: 'Test Callsign',
                    archived: true,
                    center: [123.3223, 123.0002],
                    testprop: 1,
                    testnested: {
                        deep: 1
                    }
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123]
                }
            }
        }, true);


        // Properties might be stripped by rigid CoT schema
        assert.deepEqual(res.body, {
            id: 'my-feature-id',
            type: 'Feature',
            path: '/Test Features/',
            properties: {
                type: 'a-f-g',
                how: 'm-g',
                archived: true,
                callsign: 'Test Callsign',
                time: time,
                start: time,
                stale: time,
                center: [123.3223, 123.0002],
            },
            geometry: {
                type: 'Point',
                coordinates: [123.3223, 123.0002, 123]
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/feature - List', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                id: 'my-feature-id',
                type: 'Feature',
                path: '/Test Features/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    archived: true,
                    callsign: 'Test Callsign',
                    time: time,
                    start: time,
                    stale: time,
                    center: [123.3223, 123.0002],
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123]
                }
            }]
        });
    } catch (err) {
        assert.ifError(err);
    }
});


test('GET: api/connection/1/feature/:id', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature/my-feature-id', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
             id: 'my-feature-id',
            type: 'Feature',
            path: '/Test Features/',
            properties: {
                type: 'a-f-g',
                how: 'm-g',
                archived: true,
                callsign: 'Test Callsign',
                time: time,
                start: time,
                stale: time,
                center: [123.3223, 123.0002],
            },
            geometry: {
                type: 'Point',
                coordinates: [123.3223, 123.0002, 123]
            }
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/connection/1/feature/:id', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature/my-feature-id', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

         assert.deepEqual(res.body, {
            status: 200,
            message: 'Feature Deleted'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/feature/:id - 404', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature/my-feature-id', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, false);

        assert.deepEqual(res.body, {
            status: 404,
            message: 'Item Not Found',
            messages: []
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/connection/1/feature - Create another', async () => {
     try {
        const res = await flight.fetch('/api/connection/1/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: 'feature-2',
                type: 'Feature',
                path: '/Test Features/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    center: [0, 0],
                },
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0]
                }
            }
        }, true);


        assert.deepEqual(res.body, {
            id: 'feature-2',
            type: 'Feature',
            path: '/Test Features/',
            properties: {
                type: 'a-f-g',
                how: 'm-g',
                time: time,
                start: time,
                stale: time,
                center: [0, 0],
                archived: true,
                callsign: 'UNKNOWN'
            },
            geometry: {
                type: 'Point',
                coordinates: [0, 0, 0]
            }
        });

    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/connection/1/feature - Delete All', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

         assert.deepEqual(res.body, {
            status: 200,
            message: 'Features Deleted'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/feature - Empty', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/feature', {
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

flight.landing();
