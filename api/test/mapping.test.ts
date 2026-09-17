import test from 'node:test';
import assert from 'node:assert';
import Mapping from '../common/mapping.js';
import { LayerMapping_Destination, CoreEvent_Priority } from '../common/enums.js';

const throwsSafe = (fn: () => unknown, expected: RegExp) => {
    assert.throws(fn, (err: unknown) => {
        assert.match(String((err as { safe?: string }).safe), expected);
        return true;
    });
};

const point = (metadata: Record<string, unknown>, properties: Record<string, unknown> = {}) => ({
    id: 'unit-1',
    type: 'Feature' as const,
    properties: { ...properties, metadata },
    geometry: { type: 'Point' as const, coordinates: [-105, 39] },
});

test('Mapping: CoreFeature - defaults & query maps in insertion order', async () => {
    const mapping = new Mapping([{
        schema: 'unit',
        destination: LayerMapping_Destination.COREFEATURE,
        queries: [{
            id: 1,
            name: 'Defaults',
            query: null,
            map: {
                callsign: '{{name}} ({{status}})',
                remarks: 'Unit {{name}}',
                stale: 60,
                minzoom: '{{zoom}}',
                links: [{ url: 'https://example.com/{{name}}', remarks: 'Unit page' }],
                marti: { archive: true, dest: [{ mission: 'Ops' }] },
                point: { 'marker-color': '#00ff00', 'marker-opacity': '0.5', 'rotate': false, 'type': 'a-f-G-{{kind}}' },
                line: { stroke: '#123456' },
            },
        }, {
            id: 2,
            name: 'Offline',
            query: 'properties.metadata.status = "offline"',
            map: { remarks: 'OFFLINE', point: { 'marker-color': '#ff0000' } },
        }],
    }, {
        schema: 'incident',
        destination: LayerMapping_Destination.COREFEATURE,
        queries: [{ id: 3, name: 'Other', query: null, map: { callsign: 'WRONG' } }],
    }], 'unit');

    const online = await mapping.feature(point({ name: 'Alpha', status: 'online', zoom: '8', kind: 'U' }));

    assert.deepEqual(online.properties, {
        'metadata': { name: 'Alpha', status: 'online', zoom: '8', kind: 'U' },
        'callsign': 'Alpha (online)',
        'remarks': 'Unit Alpha',
        'stale': 60000,
        'minzoom': 8,
        'links': [{ uid: 'unit-1', relation: 'r-u', mime: 'text/html', url: 'https://example.com/Alpha', remarks: 'Unit page' }],
        'marti_archive': true,
        'dest': [{ mission: 'Ops' }],
        'marker-color': '#00ff00',
        'marker-opacity': 0.5,
        'rotate': false,
        'type': 'a-f-G-U',
    });

    const offline = await mapping.feature(point({ name: 'Bravo', status: 'offline' }));

    assert.equal(offline.properties.callsign, 'Bravo (offline)');
    assert.equal(offline.properties.remarks, 'OFFLINE');
    assert.equal(offline.properties['marker-color'], '#ff0000');
    assert.equal(offline.properties.minzoom, undefined);
});

test('Mapping: CoreFeature - geometry blocks only apply to their geometry', async () => {
    const mapping = new Mapping([{
        schema: 'unit',
        destination: LayerMapping_Destination.COREFEATURE,
        queries: [{
            id: 1,
            name: 'Defaults',
            query: null,
            map: {
                point: { 'marker-color': '#00ff00' },
                line: { 'type': 'b-m-r', 'stroke': '#0000ff', 'stroke-width': '3' },
                polygon: { 'fill': '#ffff00', 'fill-opacity': 0.25 },
            },
        }],
    }], 'unit');

    const line = await mapping.feature({
        id: 'line-1',
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
    });

    assert.deepEqual(line.properties, {
        'metadata': {},
        'type': 'b-m-r',
        'stroke': '#0000ff',
        'stroke-width': 3,
    });

    const polygon = await mapping.feature({
        id: 'poly-1',
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    });

    assert.deepEqual(polygon.properties, {
        'metadata': {},
        'fill': '#ffff00',
        'fill-opacity': 0.25,
    });
});

test('Mapping: CoreFeature - stale template renders to seconds or a timestamp', async () => {
    const mapping = new Mapping([{
        schema: 'unit',
        destination: LayerMapping_Destination.COREFEATURE,
        queries: [{ id: 1, name: 'Stale', query: null, map: { stale: '{{stale}}' } }],
    }], 'unit');

    const seconds = await mapping.feature(point({ stale: 120 }));
    assert.equal(seconds.properties.stale, 120000);

    const timestamp = await mapping.feature(point({ stale: '2030-01-01T00:00:00Z' }));
    assert.equal(timestamp.properties.stale, '2030-01-01T00:00:00Z');
});

test('Mapping: CoreEvent - fields rendered against metadata', async () => {
    const mapping = new Mapping([{
        schema: 'incident',
        destination: LayerMapping_Destination.COREEVENT,
        queries: [{
            id: 1,
            name: 'Defaults',
            query: null,
            map: {
                name: '{{title}}',
                type: '10031000001211000000',
                priority: 'low',
                location: '{{address}}',
                remarks: '{{htmlstrip description}}',
                ended: '{{closed}}',
                external_id: 'inc-{{number}}',
                editable: false,
            },
        }, {
            id: 2,
            name: 'Critical',
            query: 'properties.metadata.severity > 3',
            map: { priority: 'critical' },
        }],
    }], 'incident');

    const open = await mapping.event(point({ title: 'Fire', address: '1 Main St', description: '<b>Big</b> fire', closed: '', number: 7, severity: 2 }));

    assert.deepEqual(open, {
        name: 'Fire',
        type: '10031000001211000000',
        priority: CoreEvent_Priority.LOW,
        location: '1 Main St',
        remarks: 'Big fire',
        ended: null,
        external_id: 'inc-7',
        editable: false,
    });

    const closed = await mapping.event(point({ title: 'Flood', address: '', description: '', closed: '2026-09-01T12:00:00Z', number: 8, severity: 5 }));

    assert.equal(closed?.priority, CoreEvent_Priority.CRITICAL);
    assert.equal(closed?.ended, '2026-09-01T12:00:00.000Z');
    assert.equal(closed?.location, '');

    assert.equal(await mapping.device(point({})), null);
    assert.equal(await new Mapping(mapping.maps, 'other').event(point({})), null);
});

test('Mapping: CoreDevice - number templates & booleans', async () => {
    const mapping = new Mapping([{
        schema: 'unit',
        destination: LayerMapping_Destination.COREDEVICE,
        queries: [{
            id: 1,
            name: 'Defaults',
            query: null,
            map: {
                name: '{{name}}',
                type: '10031000001211000000',
                manufacturer: 'DJI',
                battery: '{{battery}}',
                simulated: 'true',
                status: '{{fallback health "Unknown"}}',
            },
        }],
    }], 'unit');

    const device = await mapping.device({
        id: 'dev-1',
        type: 'Feature',
        properties: { metadata: { name: 'Drone', battery: '42.5' } },
    });

    assert.deepEqual(device, {
        name: 'Drone',
        type: '10031000001211000000',
        manufacturer: 'DJI',
        battery: 42.5,
        simulated: true,
        status: 'Unknown',
    });

    assert.deepEqual(Mapping.missing(LayerMapping_Destination.COREDEVICE, { name: 'Drone' }), ['type']);
});

test('Mapping: has', () => {
    const mapping = new Mapping([{
        schema: 'unit',
        destination: LayerMapping_Destination.COREDEVICE,
        queries: [{ id: 1, name: 'Defaults', query: null, map: {} }],
    }], 'unit');

    assert.equal(mapping.has(LayerMapping_Destination.COREDEVICE), true);
    assert.equal(mapping.has(LayerMapping_Destination.COREEVENT), false);
});

test('Mapping: validate', () => {
    assert.equal(Mapping.validate(LayerMapping_Destination.COREFEATURE, {
        callsign: '{{name}}',
        minzoom: 4,
        maxzoom: '{{zoom}}',
        links: [{ url: 'https://example.com/{{id}}', remarks: 'Page' }],
        marti: { archive: true },
        line: { type: 'u-d-f' },
    }), true);

    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREFEATURE, { callsign: '{{#if name}}' }), /Invalid Callsign Template/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREFEATURE, { point: { remarks: '{{#if name}}' } }), /Invalid \(point\) Remarks Template/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREFEATURE, { minzoom: 30 }), /Greater than 24/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREFEATURE, { minzoom: 10, maxzoom: 5 }), /minzoom 10 greater than maxzoom 5/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREFEATURE, { line: { type: 'bogus' } }), /Invalid \(line\) Type: bogus/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREFEATURE, { links: [{ url: '{{#if}}', remarks: '' }] }), /Invalid Link URL/);

    assert.equal(Mapping.validate(LayerMapping_Destination.COREEVENT, { name: '{{title}}', priority: 'high', editable: true }), true);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { priority: 'urgent' }), /Invalid Priority: urgent/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { editable: 'maybe' }), /Invalid Editable/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { external_id: '{{#each' }), /Invalid External ID Template/);

    assert.equal(Mapping.validate(LayerMapping_Destination.COREDEVICE, { battery: '{{battery}}', simulated: false }), true);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREDEVICE, { battery: { pct: 1 } }), /Invalid Battery/);
});
