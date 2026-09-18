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
    const row = await mapping.match(feature);
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

    assert.equal(await new Mapping([]).match(point({})), null);
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

test('Mapping: match - a Feature is directed to the destination of the first Mapping it matches', async () => {
    const mapping = new Mapping([
        { destination: LayerMapping_Destination.COREFEATURE, query: null, mapping: { callsign: 'Default' } },
        { destination: LayerMapping_Destination.COREEVENT, query: '$bogus(', mapping: { name: 'Invalid' } },
        { destination: LayerMapping_Destination.COREEVENT, query: 'properties.metadata.kind = "incident"', mapping: { name: 'First' } },
        { destination: LayerMapping_Destination.COREEVENT, query: 'properties.metadata.kind = "incident"', mapping: { name: 'Second' } },
        { destination: LayerMapping_Destination.COREDEVICE, query: 'properties.metadata.kind = "unit"', mapping: { name: 'Unit' } },
        { destination: LayerMapping_Destination.COREDEVICE, query: null, mapping: { name: 'Default Device' } },
    ]);

    assert.deepEqual((await mapping.match(point({ kind: 'incident' })))?.mapping, { name: 'First' });
    assert.deepEqual((await mapping.match(point({ kind: 'unit' })))?.mapping, { name: 'Unit' });

    // No query matched - the first Default Query in insertion order wins whatever its destination
    assert.deepEqual((await mapping.match(point({ kind: 'other' })))?.mapping, { callsign: 'Default' });

    assert.equal(await new Mapping([]).match(point({})), null);
});

test('Mapping: CoreEvent - templated enums & booleans, nested style, links & channels', async () => {
    const mapping = new Mapping(rows(LayerMapping_Destination.COREEVENT, [{
        query: null,
        mapping: {
            name: '{{title}}',
            type: '10031000001211000000',
            priority: '{{severity}}',
            active: '{{open}}',
            editable: false,
            channels: [3, 7, 3],
            style: { 'icon': 'abc:Fire/fire.png', 'marker-color': '{{colour}}', 'marker-opacity': '{{opacity}}' },
            links: [
                { name: 'Incident {{number}}', url: 'https://example.com/{{number}}' },
                { name: 'Not a URL', url: '{{number}}' },
            ],
        },
    }]));

    assert.deepEqual(await convert(mapping, point({ title: 'Fire', severity: 'HIGH', open: 'False', colour: '#ff0000', opacity: '0.5', number: 12 })), {
        name: 'Fire',
        type: '10031000001211000000',
        priority: CoreEvent_Priority.HIGH,
        active: false,
        editable: false,
        channels: [3, 7],
        style: { 'icon': 'abc:Fire/fire.png', 'marker-color': '#ff0000', 'marker-opacity': 0.5 },
        links: [{ name: 'Incident 12', url: 'https://example.com/12' }],
    });

    // Values that do not render to an option, a boolean or a number in range are left unset
    const unknown = await convert(mapping, point({ title: 'Flood', severity: 'extreme', open: 'unsure', opacity: '7', number: 13 }));
    assert.equal(unknown.priority, undefined);
    assert.equal(unknown.active, undefined);
    assert.deepEqual(unknown.style, { 'icon': 'abc:Fire/fire.png', 'marker-color': '' });
});

test('Mapping: CoreDevice - event_external_id & channels', async () => {
    const mapping = new Mapping(rows(LayerMapping_Destination.COREDEVICE, [{
        query: null,
        mapping: { name: '{{unit}}', type: '10031000001211000000', simulated: '{{sim}}', event_external_id: 'inc-{{incident}}', channels: [3] },
    }]));

    assert.deepEqual(await convert(mapping, point({ unit: 'Engine 1', sim: true, incident: 12 })), {
        name: 'Engine 1',
        type: '10031000001211000000',
        simulated: true,
        event_external_id: 'inc-12',
        channels: [3],
    });
});

test('Mapping: createOnly - { value, update } fields', async () => {
    const [row] = rows(LayerMapping_Destination.COREEVENT, [{
        query: null,
        mapping: {
            name: { value: '{{title}}', update: false },
            type: { value: '10031000001211000000' },
            priority: 'low',
            channels: { value: [3], update: false },
            style: { 'icon': { value: 'abc:fire.png', update: false }, 'marker-color': { value: '#ff0000', update: true } },
        },
    }]);

    assert.deepEqual(Mapping.createOnly(row), new Set(['name', 'channels', 'style.icon']));

    assert.deepEqual(await convert(new Mapping([row]), point({ title: 'Fire' })), {
        name: 'Fire',
        type: '10031000001211000000',
        priority: CoreEvent_Priority.LOW,
        channels: [3],
        style: { 'icon': 'abc:fire.png', 'marker-color': '#ff0000' },
    });

    assert.equal(Mapping.validate(LayerMapping_Destination.COREEVENT, row.mapping), true);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { name: { value: '{{title}}', update: 'no' } }), /Invalid Name: update must be a boolean/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { name: { value: '{{#if}}', update: false } }), /Invalid Name Template/);
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

    assert.equal(Mapping.validate(LayerMapping_Destination.COREEVENT, {
        priority: '{{severity}}',
        active: '{{open}}',
        channels: [1, 2],
        style: { 'marker-color': '#ff0000', 'marker-opacity': 0.5 },
        links: [{ name: 'Page', url: 'https://example.com/{{id}}' }],
    }), true);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { priority: '{{#if}}' }), /Invalid Priority Template/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { channels: ['one'] }), /Invalid Channels/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { style: { 'marker-opacity': 2 } }), /Invalid \(style\) Marker Opacity: 2 - Greater than 1/);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREEVENT, { links: [{ name: 'Page', url: '{{#if}}' }] }), /Invalid Links url Template/);

    assert.equal(Mapping.validate(LayerMapping_Destination.COREDEVICE, { battery: '{{battery}}', simulated: false, event_external_id: 'inc-{{incident}}' }), true);
    throwsSafe(() => Mapping.validate(LayerMapping_Destination.COREDEVICE, { battery: { pct: 1 } }), /Invalid Battery/);
});
