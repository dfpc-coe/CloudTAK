process.env.SigningSecret = 'coe-wildland-fire';
import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

test('GET: api/marti/missions/:guid/cot - Invalid CoTs are isolated from valid Features', async () => {
    flight.tak.mockMarti.push(async (request: IncomingMessage, response: ServerResponse) => {
        if (!request.method || !request.url) return false;

        const url = new URL(request.url, 'http://localhost');

        if (request.method === 'GET' && url.pathname === '/Marti/api/missions/Test%20Mission/cot') {
            response.setHeader('Content-Type', 'application/xml');
            response.write(`
                <events>
                    <event version="2.0" uid="uid-valid" type="a-f-G" time="2026-08-11T00:00:00.000Z" start="2026-08-11T00:00:00.000Z" stale="2026-08-11T00:05:00.000Z" how="h-g-i-g-o">
                        <point lat="1.1" lon="2.2" hae="0.0" ce="9999999.0" le="9999999.0"/>
                        <detail>
                            <contact callsign="ALPHA"/>
                        </detail>
                    </event>
                    <event version="2.0" uid="uid-poisoned" type="a-f-G" time="2026-08-11T00:00:00.000Z" start="2026-08-11T00:00:00.000Z" stale="2026-08-11T00:05:00.000Z" how="h-g-i-g-o">
                        <detail>
                            <contact callsign="BRAVO"/>
                        </detail>
                    </event>
                </events>
            `);
            response.end();
            return true;
        }

        return false;
    });

    try {
        const res = await flight.fetch('/api/marti/missions/Test Mission/cot', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
            headers: {
                missionauthorization: 'test-mission-token',
            },
        }, true);

        assert.equal(res.body.type, 'FeatureCollection');

        assert.equal(res.body.features.length, 1);
        assert.equal(res.body.features[0].id, 'uid-valid');
        assert.equal(res.body.features[0].properties.callsign, 'ALPHA');

        assert.equal(res.body.invalid.length, 1);
        assert.equal(res.body.invalid[0].id, 'uid-poisoned');
        assert.equal(res.body.invalid[0].callsign, 'BRAVO');
        assert.ok(res.body.invalid[0].error.length > 0);
    } catch (err) {
        assert.ifError(err);
    }

    flight.tak.reset();
});

flight.landing();
