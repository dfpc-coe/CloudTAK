import test from 'tape';
import assert from 'node:assert';
import Filter from '../lib/filter.js';
import { CoT } from '@tak-ps/node-tak';

test('Filter: Basic Point', async () => {
    const filter = await Filter.test({
        queries: [{
            query: 'properties.callsign = "TEST"'
        }]
    }, CoT.from_geojson({
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    }));

    assert.equal(filter, false);
});

test('Filter: Callsign Match', async () => {
    const filter = await Filter.test({
        queries: [{
            query: 'properties.callsign = "TEST"'
        }]
    }, CoT.from_geojson({
        type: 'Feature',
        properties: {
            callsign: 'TEST'
        },
        geometry: {
            type: 'Point',
            coordinates: [0, 0]
        }
    }));

    assert.equal(filter, true);
});
