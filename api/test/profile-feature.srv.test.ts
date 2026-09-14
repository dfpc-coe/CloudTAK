import test from 'node:test';
import assert from 'node:assert';
import { sql } from 'drizzle-orm';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString();

test('GET: api/profile/feature', async () => {
    try {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            total: 0,
            items: [],
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
                bearer: flight.token.admin,
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
                        deep: 1,
                    },
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123],
                },
            },
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
                coordinates: [123.3223, 123.0002, 123],
            },
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
                bearer: flight.token.admin,
            },
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
                    coordinates: [123.3223, 123.0002, 123],
                },
            }],
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
                bearer: flight.token.admin,
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
                        deep: 1,
                    },
                },
                geometry: {
                    type: 'Point',
                    coordinates: [123.3223, 123.0002, 123],
                },
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
                coordinates: [123.3223, 123.0002, 123],
            },
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
                bearer: flight.token.admin,
            },
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
                    coordinates: [123.3223, 123.0002, 123],
                },
            }],
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
                bearer: flight.token.admin,
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
                coordinates: [123.3223, 123.0002, 123],
            },
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
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            status: 200,
            message: 'Feature Deleted',
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/profile/feature - Enabled Geofence', async () => {
    try {
        await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                id: 'geofence-profile',
                type: 'Feature',
                path: '/',
                properties: {
                    type: 'a-f-g',
                    how: 'm-g',
                    time: time,
                    start: time,
                    stale: time,
                    callsign: 'Profile Geofence',
                    center: [0, 0],
                    geofence: {
                        elevationMonitored: false,
                        monitor: 'All',
                        trigger: 'Entry',
                        tracking: true,
                    },
                },
                geometry: {
                    type: 'Point',
                    coordinates: [0, 0],
                },
            },
        }, true);

        const feature = await flight.config!.models.ProfileFeature.from(sql`
            id = ${'geofence-profile'} AND username = ${'admin@example.com'}
        `);

        assert.equal(feature.enabled_geofence, true);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PUT: api/profile/feature - Reject User Puck', async () => {
    const base = {
        type: 'Feature',
        path: '/',
        geometry: {
            type: 'Point',
            coordinates: [123.3223, 123.0002, 123],
        },
    };

    const properties = {
        type: 'a-f-G-E-V-C',
        how: 'm-g',
        time: time,
        start: time,
        stale: time,
        callsign: 'User Puck',
        archived: true,
        center: [123.3223, 123.0002],
    };

    for (const body of [
        { ...base, id: 'ANDROID-CloudTAK-puck@example.com', properties },
        { ...base, id: 'puck-group', properties: { ...properties, group: { name: 'Cyan', role: 'Team Member' } } },
        { ...base, id: 'puck-takv', properties: { ...properties, takv: { device: 'Pixel', platform: 'ATAK', os: '34', version: '5.0' } } },
    ]) {
        const res = await flight.fetch('/api/profile/feature', {
            method: 'PUT',
            auth: {
                bearer: flight.token.admin,
            },
            body,
        }, false);

        assert.equal(res.status, 400, `expected 400 for ${body.id}`);
        assert.equal(res.body.message, 'User markers cannot be saved as features');
    }

    const list = await flight.fetch('/api/profile/feature', {
        method: 'GET',
        auth: {
            bearer: flight.token.admin,
        },
    }, true);

    assert.ok(!list.body.items.some((f: { id: string }) => f.id.startsWith('puck') || f.id.startsWith('ANDROID-')));
});

flight.landing();
