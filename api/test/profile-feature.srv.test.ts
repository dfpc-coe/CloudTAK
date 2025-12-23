import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init();
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString()

test('GET: api/profile/feature', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
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

test('PUT: api/profile/feature', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: '123',
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

        assert.deepEqual(res.body, {
            id: '123',
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

test('GET: api/profile/feature', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                id: '123',
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

test('PUT: api/profile/feature - UPSERT', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin
            },
            body: {
                id: '123',
                type: 'Feature',
                path: '/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    callsign: 'Test Callsign UPDATED',
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

        assert.deepEqual(res.body, {
            id: '123',
            type: 'Feature',
            path: '/',
            properties: {
                type: 'a-f-g',
                how: 'm-g',
                archived: true,
                callsign: 'Test Callsign UPDATED',
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

test('GET: api/profile/feature', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            }
        }, true);

        assert.deepEqual(res.body, {
            total: 1,
            items: [{
                id: '123',
                type: 'Feature',
                path: '/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    archived: true,
                    callsign: 'Test Callsign UPDATED',
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

test('GET: api/profile/feature/123', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature/123', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin
            },
        }, true);

        assert.deepEqual(res.body, {
            id: '123',
            type: 'Feature',
            path: '/',
            properties: {
                type: 'a-f-g',
                how: 'm-g',
                archived: true,
                callsign: 'Test Callsign UPDATED',
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

test('DELETE: api/profile/feature/123', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature/123', {
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

flight.landing();
