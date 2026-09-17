import test from 'node:test';
import assert from 'node:assert';
import Mapping from '../common/mapping.js';
import type { MappingFeature } from '../common/mapping.js';
import { LayerMapping_Destination, CoreEvent_Priority } from '../common/enums.js';

const throwsSafe = (fn: () => unknown, expected: RegExp) => {
    assert.throws(fn, (err: unknown) => {
        assert.match(String((err as { safe?: string }).safe), expected);
        return true;
    });
};

const rows = (destination: LayerMapping_Destination, queries: Array<{ query: string | null; mapping: Record<string, unknown> }>) => {
    return queries.map(q => ({ destination, ...q }));
};

const convert = async (mapping: Mapping, feature: MappingFeature) => {
    const row = await mapping.match(mapping.rows[0].destination, feature);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return row ? mapping.render(row, feature) as any : null;
};

const point = (metadata: Record<string, unknown>, properties: Record<string, unknown> = {}) => ({
    id: 'unit-1',
    type: 'Feature' as const,
    properties: { ...properties, metadata },
    geometry: { type: 'Point' as const, coordinates: [-105, 39] },
});

test('Mapping: CoreFeature - a matched query wins over the default Mapping', async () => {
    const mapping = new Mapping(rows(LayerMapping_Destination.COREFEATURE, [{
        query: null,
        mapping: {
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
        query: 'properties.metadata.status = "offline"',
        mapping: { remarks: 'OFFLINE', point: { 'marker-color': '#ff0000' } },
    }]));

    const online = await convert(mapping, point({ name: 'Alpha', status: 'online', zoom: '8', kind: 'U' }));

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

    const offline = await convert(mapping, point({ name: 'Bravo', status: 'offline' }));

    // Queries are mutually exclusive - the matched query replaces the default Mapping rather than layering over it
    assert.deepEqual(offline.properties, {
        'metadata': { name: 'Bravo', status: 'offline' },
        'remarks': 'OFFLINE',
        'marker-color': '#ff0000',
    });
});

test('Mapping: CoreFeature - geometry blocks only apply to their geometry', async () => {
    const mapping = new Mapping(rows(LayerMapping_Destination.COREFEATURE, [{
        query: null,
        mapping: {
            point: { 'marker-color': '#00ff00' },
            line: { 'type': 'b-m-r', 'stroke': '#0000ff', 'stroke-width': '3' },
            polygon: { 'fill': '#ffff00', 'fill-opacity': 0.25 },
        },
    }]));

    const line = await convert(mapping, {
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

    const polygon = await convert(mapping, {
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
    const mapping = new Mapping(rows(LayerMapping_Destination.COREFEATURE, [{ query: null, mapping: { stale: '{{stale}}' } }]));

    const seconds = await convert(mapping, point({ stale: 120 }));
    assert.equal(seconds.properties.stale, 120000);

    const timestamp = await convert(mapping, point({ stale: '2030-01-01T00:00:00Z' }));
    assert.equal(timestamp.properties.stale, '2030-01-01T00:00:00Z');
});

test('Mapping: CoreEvent - fields rendered against metadata', async () => {
    const mapping = new Mapping(rows(LayerMapping_Destination.COREEVENT, [{
        query: null,
        mapping: {
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
        query: 'properties.metadata.severity > 3',
        mapping: { priority: 'critical', ended: '{{closed}}' },
    }]));

    const open = await convert(mapping, point({ title: 'Fire', address: '1 Main St', description: '<b>Big</b> fire', closed: '', number: 7, severity: 2 }));

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

    const closed = await convert(mapping, point({ title: 'Flood', address: '', description: '', closed: '2026-09-01T12:00:00Z', number: 8, severity: 5 }));

    assert.deepEqual(closed, { priority: CoreEvent_Priority.CRITICAL, ended: '2026-09-01T12:00:00.000Z' });

    assert.equal(await mapping.match(LayerMapping_Destination.COREDEVICE, point({})), null);
});

test('Mapping: CoreDevice - number templates & booleans', async () => {
    const mapping = new Mapping(rows(LayerMapping_Destination.COREDEVICE, [{
        query: null,
        mapping: {
            name: '{{name}}',
            type: '10031000001211000000',
            manufacturer: 'DJI',
            battery: '{{battery}}',
            simulated: 'true',
            status: '{{fallback health "Unknown"}}',
        },
    }]));

    const device = await convert(mapping, {
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
});

test('Mapping: match - one Mapping per destination', async () => {
    const mapping = new Mapping([
        { destination: LayerMapping_Destination.COREFEATURE, query: null, mapping: { callsign: 'Default' } },
        { destination: LayerMapping_Destination.COREEVENT, query: '$bogus(', mapping: { name: 'Invalid' } },
        { destination: LayerMapping_Destination.COREEVENT, query: 'properties.metadata.kind = "incident"', mapping: { name: 'First' } },
        { destination: LayerMapping_Destination.COREEVENT, query: 'properties.metadata.kind = "incident"', mapping: { name: 'Second' } },
    ]);

    const incident = point({ kind: 'incident' });

    assert.deepEqual((await mapping.match(LayerMapping_Destination.COREEVENT, incident))?.mapping, { name: 'First' });
    assert.deepEqual((await mapping.match(LayerMapping_Destination.COREFEATURE, incident))?.mapping, { callsign: 'Default' });
    assert.equal(await mapping.match(LayerMapping_Destination.COREDEVICE, incident), null);
    assert.equal(await mapping.match(LayerMapping_Destination.COREEVENT, point({ kind: 'other' })), null);
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
