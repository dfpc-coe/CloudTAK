import test from 'node:test';
import assert from 'node:assert';
import ws from 'ws';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

const time = new Date('2025-03-04T22:54:15.447Z').toISOString();

/**
 * Build a CoT-shaped GeoJSON Feature mirroring the payload native
 * wrappers (iOS BackgroundLocationPlugin / future Android) submit to
 * the `/api/profile/location` route.
 */
function buildLocationFeature(opts: Partial<{
    uid: string;
    callsign: string;
    coordinates: [number, number, number];
}> = {}) {
    const uid = opts.uid || 'ANDROID-CloudTAK-admin@example.com';
    const callsign = opts.callsign || 'TEST-1';
    const coordinates = opts.coordinates || [-105.2705, 40.0150, 1655];

    return {
        id: uid,
        type: 'Feature' as const,
        properties: {
            type: 'a-f-G-U-C',
            how: 'm-g',
            callsign,
            droid: callsign,
            time,
            start: time,
            stale: time,
            center: [coordinates[0], coordinates[1]],
            contact: { endpoint: '*:-1:stcp', callsign },
            takv: {
                device: 'iPhone',
                platform: 'CloudTAK-iOS',
                os: '17.0',
                version: '1.0.0'
            }
        },
        geometry: {
            type: 'Point' as const,
            coordinates
        }
    };
}

test('POST: api/profile/location - missing auth returns 401', async () => {
    try {
        const res = await flight.fetch('/api/profile/location', {
            method: 'POST',
            body: buildLocationFeature()
        }, false);

        assert.equal(res.status, 401, 'http: 401');
        assert.equal(res.body.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/location - empty body fails schema validation', async () => {
    try {
        const res = await flight.fetch('/api/profile/location', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {}
        }, false);

        assert.equal(res.status, 400, 'http: 400');
        assert.equal(res.body.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/location - non-Feature type rejected', async () => {
    try {
        const res = await flight.fetch('/api/profile/location', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                type: 'FeatureCollection',
                features: []
            }
        }, false);

        assert.equal(res.status, 400, 'http: 400');
        assert.equal(res.body.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/location - happy path returns Submitted', async () => {
    try {
        const res = await flight.fetch('/api/profile/location', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: buildLocationFeature()
        }, true);

        assert.equal(res.status, 200, 'http: 200');
        assert.deepEqual(res.body, {
            status: 200,
            message: 'Location Submitted'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/location - accepts profile API token (etl.*) used by native uploads', async () => {
    try {
        // Mint a long-lived profile token, the same flow native iOS
        // wrappers use to authenticate background uploads.
        const tokenRes = await flight.fetch('/api/profile/token', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: { name: 'iOS Background Location' }
        }, true);

        const apiToken = tokenRes.body.token as string;
        assert.ok(apiToken.startsWith('etl.'), 'profile token should be prefixed etl.');

        const res = await flight.fetch('/api/profile/location', {
            method: 'POST',
            auth: { bearer: apiToken },
            body: buildLocationFeature({ callsign: 'TEST-2' })
        }, true);

        assert.equal(res.status, 200, 'http: 200');
        assert.deepEqual(res.body, {
            status: 200,
            message: 'Location Submitted'
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/profile/location - submission echoes back through the per-user WebSocket', async () => {
    // Open the per-user WebSocket as a `geojson`-format subscriber.
    // The route calls `config.conns.cots(...)` after writing to TAK so
    // that other open browser tabs (or the same tab making the POST)
    // see their own self-position update — TAK Server itself does not
    // rebroadcast to the sender. Verifying the echo proves both the
    // TAK write path and the in-process fan-out are wired up correctly.
    const url = new URL('ws://localhost:5001');
    url.searchParams.append('format', 'geojson');
    url.searchParams.append('connection', 'admin@example.com');
    url.searchParams.append('token', flight.token.admin);

    const conn = new ws(url);

    await new Promise<void>((resolve, reject) => {
        const fail = setTimeout(
            () => reject(new Error('Timed out waiting for WebSocket echo of submitted location')),
            5000
        );

        conn.on('error', (err) => {
            clearTimeout(fail);
            reject(err);
        });

        conn.on('message', async (data) => {
            try {
                const msg = JSON.parse(String(data));

                if (msg.type === 'connected') {
                    const res = await flight.fetch('/api/profile/location', {
                        method: 'POST',
                        auth: { bearer: flight.token.admin },
                        body: buildLocationFeature({ callsign: 'WS-ECHO' })
                    }, true);

                    assert.equal(res.status, 200, 'http: 200');
                    assert.deepEqual(res.body, {
                        status: 200,
                        message: 'Location Submitted'
                    });
                    return;
                }

                if (msg.type === 'status' || msg.type === 'chat') return;

                assert.equal(msg.type, 'cot');
                assert.equal(msg.connection, 'admin@example.com');
                assert.ok(msg.data, 'WebSocket message should carry feature data');
                assert.equal(
                    msg.data.id,
                    'ANDROID-CloudTAK-admin@example.com',
                    'Echoed feature id should match submitted UID'
                );
                assert.equal(msg.data.properties.callsign, 'WS-ECHO');

                clearTimeout(fail);
                conn.close();
                resolve();
            } catch (err) {
                clearTimeout(fail);
                reject(err);
            }
        });
    });
});

flight.landing();
