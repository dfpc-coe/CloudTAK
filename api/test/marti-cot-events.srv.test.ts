process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/marti/cot - proxies the Situational Awareness query', async () => {
    let captured: URL | undefined;

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/Marti/api/cot/sa') {
            captured = url;

            response.setHeader('Content-Type', 'application/xml');
            response.write(`
                <events>
                    <event version="2.0" uid="sensor-1" type="a-f-G" time="2026-10-26T10:00:00.000Z" start="2026-10-26T10:00:00.000Z" stale="2026-10-26T10:05:00.000Z" how="m-g">
                        <point lat="39.7" lon="-104.9" hae="1600.0" ce="10.0" le="10.0"/>
                        <detail><contact callsign="SEE_1"/></detail>
                    </event>
                    <event version="2.0" uid="sensor-1" type="a-f-G" time="2026-10-26T10:01:00.000Z" start="2026-10-26T10:01:00.000Z" stale="2026-10-26T10:06:00.000Z" how="m-g">
                        <point lat="39.71" lon="-104.91" hae="1600.0" ce="10.0" le="10.0"/>
                        <detail><contact callsign="SEE_1"/></detail>
                    </event>
                </events>
            `);
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/cot?start=2026-10-26T09:00:00.000Z&end=2026-10-26T11:00:00.000Z&bbox=-105,39,-104,40&filtered=false', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(captured);
        assert.equal(captured.searchParams.get('start'), '2026-10-26T09:00:00.000Z');
        assert.equal(captured.searchParams.get('end'), '2026-10-26T11:00:00.000Z');
        assert.equal(captured.searchParams.get('left'), '-105');
        assert.equal(captured.searchParams.get('bottom'), '39');
        assert.equal(captured.searchParams.get('right'), '-104');
        assert.equal(captured.searchParams.get('top'), '40');
        assert.equal(captured.searchParams.get('isFiltered'), 'false');

        assert.equal(res.body.type, 'FeatureCollection');
        assert.equal(res.body.features.length, 2);
        assert.equal(res.body.features[0].id, 'sensor-1');
        assert.equal(res.body.features[0].properties.time, '2026-10-26T10:00:00.000Z');
        assert.equal(res.body.features[1].properties.time, '2026-10-26T10:01:00.000Z');
        assert.deepEqual(res.body.features[1].geometry.coordinates, [-104.91, 39.71, 1600]);
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/cot - empty TAK Server reply is an empty collection', async () => {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/Marti/api/cot/sa') {
            response.statusCode = 404;
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/cot?secago=600', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.deepEqual(res.body, {
            type: 'FeatureCollection',
            features: [],
        });
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/cot - secago is resolved to an explicit window', async () => {
    let captured: URL | undefined;

    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/Marti/api/cot/sa') {
            captured = url;
            response.statusCode = 404;
            response.end();
            return true;
        }

        return false;
    });

    try {
        const before = Date.now();
        await flight.fetch('/api/marti/cot?secago=7200', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.ok(captured);
        const start = Date.parse(String(captured.searchParams.get('start')));
        const end = Date.parse(String(captured.searchParams.get('end')));
        assert.equal(end - start, 7200 * 1000);
        assert.ok(end >= before && end <= Date.now());
        assert.equal(captured.searchParams.get('left'), null);
        assert.equal(captured.searchParams.get('isFiltered'), 'true');
    } catch (err) {
        assert.ifError(err);
    } finally {
        flight.tak.reset();
    }
});

test('GET: api/marti/cot - malformed bbox is rejected', async () => {
    try {
        const res = await flight.fetch('/api/marti/cot?bbox=3,2,1,4', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'bbox min must not exceed max');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/marti/cot - window longer than 24 hours is rejected', async () => {
    try {
        const res = await flight.fetch('/api/marti/cot?start=2026-10-24T00:00:00.000Z&end=2026-10-26T00:00:00.000Z', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Window must be 24 hours or less');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
