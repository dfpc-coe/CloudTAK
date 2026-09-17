import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';
import { ConnectionFeature, CoreEvent, CoreEventChannel, CoreDevice } from '../common/schema.js';
import { LayerMapping_Destination } from '../common/enums.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');
const otherLayerToken = 'etl.' + jwt.sign({ access: 'layer', id: 2, internal: true }, 'coe-wildland-fire');

test('Setup: Create Layers', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Submit Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
        });

        await flight.config!.models.LayerIncoming.generate({
            layer: 1,
        });

        await flight.config!.models.Connection.generate({
            name: 'Other Connection',
            description: '',
            auth: { cert: 'cert', key: 'key' },
        });

        await flight.config!.models.Layer.generate({
            name: 'Other Layer',
            task: 'test-task-v1.0.0',
            connection: 2,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - no auth', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            body: { type: 'FeatureCollection', schema: 'unit', features: [] },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - layer token from another connection', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: otherLayerToken,
            },
            body: { type: 'FeatureCollection', schema: 'unit', features: [] },
        }, false);

        assert.equal(res.status, 401);
        assert.equal(res.body.message, 'Layer does not belong to this Connection');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - schema is required', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: { type: 'FeatureCollection', features: [] },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - invalid geometry type', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'unit',
                features: [{
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'MultiPoint', coordinates: [[0, 0]] },
                }],
            },
        }, false);

        assert.equal(res.status, 400);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - empty', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: { type: 'FeatureCollection', schema: 'unit', features: [] },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            status: 200,
            message: 'No features found',
            submitted: 0,
            events: 0,
            devices: 0,
            errors: [],
            skipped: [],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - features without geometry are skipped', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'unit',
                features: [{
                    id: 'no-geom-1',
                    type: 'Feature',
                    properties: { callsign: 'Device One', type: 'a-f-G' },
                }, {
                    id: 'no-geom-2',
                    type: 'Feature',
                    properties: { callsign: 'Device Two' },
                    geometry: null,
                }],
            },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.message, 'No features found');
        assert.equal(res.body.submitted, 0);
        assert.deepEqual(res.body.errors, []);
        assert.equal(res.body.skipped.length, 2);
        assert.equal(res.body.skipped[0].reason, 'Feature has no geometry');
        assert.equal(res.body.skipped[0].feature.id, 'no-geom-1');
        assert.equal(res.body.skipped[1].feature.id, 'no-geom-2');
        assert.equal(res.body.skipped[1].feature.geometry, null);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - features with geometry are archived with a layer token', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'unit',
                features: [{
                    id: 'point-1',
                    type: 'Feature',
                    properties: { callsign: 'Point One', type: 'a-f-G', stale: 3600 },
                    geometry: { type: 'Point', coordinates: [-105, 39] },
                }, {
                    id: 'no-geom-3',
                    type: 'Feature',
                    properties: { callsign: 'Device Three' },
                    geometry: null,
                }],
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.errors, []);
        assert.equal(res.body.skipped.length, 1);
        assert.equal(res.body.skipped[0].feature.id, 'no-geom-3');

        const features = await flight.config!.pg
            .select()
            .from(ConnectionFeature);

        assert.equal(features.length, 1);
        assert.equal(features[0].id, 'point-1');
        assert.equal(features[0].connection, 1);
        assert.equal(features[0].layer, 1);
        assert.equal(features[0].properties.callsign, 'Point One');
        assert.ok(features[0].properties.flow?.['CloudTAK-Connection-1']);
        assert.ok(features[0].properties.flow?.['CloudTAK-Layer-1']);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - archive=false with a user token', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit?archive=false', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'unit',
                features: [{
                    id: 'point-2',
                    type: 'Feature',
                    properties: { callsign: 'Point Two', type: 'a-f-G', stale: 3600 },
                    geometry: { type: 'Point', coordinates: [-104, 40] },
                }],
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.errors, []);
        assert.deepEqual(res.body.skipped, []);

        const remaining = await flight.config!.models.ConnectionFeature.count();
        assert.equal(Number(remaining), 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - CoreFeature maps for the schema style the features', async () => {
    try {
        const models = flight.config!.models;

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'unit',
            destination: LayerMapping_Destination.COREFEATURE,
            name: 'Defaults',
            query: null,
            mapping: {
                callsign: '{{name}} ({{status}})',
                remarks: 'Unit {{name}}',
                point: { 'marker-color': '#00ff00' },
            },
        });

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'unit',
            destination: LayerMapping_Destination.COREFEATURE,
            name: 'Offline',
            query: 'properties.metadata.status = "offline"',
            mapping: {
                callsign: '{{name}}',
                remarks: 'OFFLINE',
                point: { 'marker-color': '#ff0000' },
            },
        });

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'unit',
            destination: LayerMapping_Destination.COREDEVICE,
            name: 'Device',
            query: null,
            mapping: { name: '{{name}}', type: '10031000001211000000', status: '{{status}}' },
        });

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'incident',
            destination: LayerMapping_Destination.COREFEATURE,
            name: 'Other Schema',
            query: null,
            mapping: { callsign: 'WRONG SCHEMA' },
        });

        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'unit',
                features: [{
                    id: 'unit-online',
                    type: 'Feature',
                    properties: { type: 'a-f-G', stale: 3600, metadata: { name: 'Alpha', status: 'online' } },
                    geometry: { type: 'Point', coordinates: [-105, 39] },
                }, {
                    id: 'unit-offline',
                    type: 'Feature',
                    properties: { type: 'a-f-G', stale: 3600, metadata: { name: 'Bravo', status: 'offline' } },
                    geometry: { type: 'Point', coordinates: [-105, 39] },
                }],
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.errors, []);
        assert.equal(res.body.submitted, 2);
        assert.equal(res.body.events, 0);
        assert.equal(res.body.devices, 2);

        const features = await flight.config!.pg
            .select()
            .from(ConnectionFeature);

        const byId = new Map(features.map(f => [f.id, f]));

        const online = byId.get('unit-online')!;
        assert.equal(online.properties.callsign, 'Alpha (online)');
        assert.equal(online.properties.remarks, 'Unit Alpha');
        assert.equal(String(online.properties['marker-color']).toLowerCase(), '#00ff00');

        const offline = byId.get('unit-offline')!;
        // Queries are mutually exclusive - the Offline Mapping replaces the default rather than layering over it
        assert.equal(offline.properties.callsign, 'Bravo');
        assert.equal(offline.properties.remarks, 'OFFLINE');
        assert.equal(String(offline.properties['marker-color']).toLowerCase(), '#ff0000');

        const devices = await flight.config!.pg.select().from(CoreDevice);
        assert.deepEqual(devices.map(d => [d.external_id, d.name, d.status]).sort(), [
            ['unit-offline', 'Bravo', 'offline'],
            ['unit-online', 'Alpha', 'online'],
        ]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - a user token has no Layer so no maps apply', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'unit',
                features: [{
                    id: 'unit-unstyled',
                    type: 'Feature',
                    properties: { callsign: 'Raw', type: 'a-f-G', stale: 3600, metadata: { name: 'Charlie', status: 'online' } },
                    geometry: { type: 'Point', coordinates: [-105, 39] },
                }],
            },
        }, true);

        assert.equal(res.status, 200);

        const features = await flight.config!.pg
            .select()
            .from(ConnectionFeature);

        const raw = features.find(f => f.id === 'unit-unstyled')!;
        assert.equal(raw.properties.callsign, 'Raw');
        assert.equal(raw.properties['marker-color'], undefined);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - CoreEvent & CoreDevice maps create records', async () => {
    try {
        const models = flight.config!.models;

        // The first matching query in insertion order wins so the most specific is created first
        await models.LayerMapping.generate({
            layer: 1,
            schema: 'incident',
            destination: LayerMapping_Destination.COREEVENT,
            name: 'Severe',
            query: 'properties.metadata.severity > 3',
            mapping: {
                name: '{{title}}',
                type: '10031000001211000000',
                priority: 'critical',
                location: '{{address}}',
                remarks: 'Incident {{number}}',
                external_id: 'inc-{{number}}',
            },
        });

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'incident',
            destination: LayerMapping_Destination.COREEVENT,
            name: 'Incident Defaults',
            query: 'properties.metadata.title != null',
            mapping: {
                name: '{{title}}',
                type: '10031000001211000000',
                priority: 'low',
                location: '{{address}}',
                remarks: 'Incident {{number}}',
                external_id: 'inc-{{number}}',
            },
        });

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'incident',
            destination: LayerMapping_Destination.COREDEVICE,
            name: 'Sensor',
            query: 'properties.metadata.sensor != null',
            mapping: {
                name: '{{sensor}}',
                type: '10031000001211000000',
                manufacturer: 'Acme',
                battery: '{{battery}}',
                simulated: false,
            },
        });

        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'incident',
                features: [{
                    id: 'incident-1',
                    type: 'Feature',
                    properties: { type: 'a-f-G', stale: 3600, metadata: { title: 'Fire', address: '1 Main St', number: 1, severity: 5, sensor: 'Sensor A', battery: '80' } },
                    geometry: { type: 'Point', coordinates: [-105, 39] },
                }, {
                    id: 'incident-2',
                    type: 'Feature',
                    properties: { type: 'a-f-G', stale: 3600, metadata: { title: 'Flood', address: '', number: 2, severity: 1 } },
                    geometry: { type: 'Polygon', coordinates: [[[-105, 39], [-104, 39], [-104, 40], [-105, 39]]] },
                }, {
                    id: 'sensor-only',
                    type: 'Feature',
                    properties: { metadata: { number: 3, sensor: 'Sensor B', battery: '20' } },
                    geometry: null,
                }],
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.errors, []);
        assert.deepEqual(res.body.skipped, []);
        assert.equal(res.body.events, 2);
        assert.equal(res.body.devices, 2);

        const events = await flight.config!.pg.select().from(CoreEvent);
        const byExternal = new Map(events.map(e => [e.external_id, e]));

        assert.equal(events.length, 2);

        const fire = byExternal.get('inc-1')!;
        assert.equal(fire.name, 'Fire');
        assert.equal(fire.type, '10031000001211000000');
        assert.equal(fire.priority, 'critical');
        assert.equal(fire.location, '1 Main St');
        assert.equal(fire.remarks, 'Incident 1');
        assert.equal(fire.connection, 1);
        assert.equal(fire.username, null);
        assert.deepEqual(fire.metadata, { title: 'Fire', address: '1 Main St', number: 1, severity: 5, sensor: 'Sensor A', battery: '80' });
        assert.deepEqual(fire.geometry.coordinates, [-105, 39]);

        const flood = byExternal.get('inc-2')!;
        assert.equal(flood.priority, 'low');
        assert.equal(flood.geometry.type, 'Point');

        const devices = await flight.config!.pg.select().from(CoreDevice);
        assert.equal(devices.length, 4);

        const a = devices.find(d => d.external_id === 'incident-1')!;
        assert.equal(a.name, 'Sensor A');
        assert.equal(a.manufacturer, 'Acme');
        assert.equal(a.battery, 80);
        assert.equal(a.simulated, false);
        assert.equal(a.connection, 1);

        const b = devices.find(d => d.external_id === 'sensor-only')!;
        assert.equal(b.name, 'Sensor B');
        assert.equal(b.battery, 20);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - resubmitting updates the mapped records in place', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'incident',
                features: [{
                    id: 'incident-1',
                    type: 'Feature',
                    properties: { type: 'a-f-G', stale: 3600, metadata: { title: 'Fire Contained', address: '1 Main St', number: 1, severity: 2, sensor: 'Sensor A', battery: '65' } },
                    geometry: { type: 'Point', coordinates: [-105.5, 39.5] },
                }],
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.errors, []);
        assert.equal(res.body.events, 1);
        assert.equal(res.body.devices, 1);

        const events = await flight.config!.pg.select().from(CoreEvent);
        assert.equal(events.length, 2);

        const fire = events.find(e => e.external_id === 'inc-1')!;
        assert.equal(fire.name, 'Fire Contained');
        assert.equal(fire.priority, 'low');
        assert.deepEqual(fire.geometry.coordinates, [-105.5, 39.5]);

        const devices = await flight.config!.pg.select().from(CoreDevice);
        assert.equal(devices.length, 4);
        assert.equal(devices.find(d => d.external_id === 'incident-1')!.battery, 65);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - concurrent submissions UPSERT a single record per external_id', async () => {
    try {
        const before = await flight.config!.pg.select().from(CoreEvent);
        const fire = before.find(e => e.external_id === 'inc-1')!;

        const responses = await Promise.all([1, 2, 3, 4, 5].map((i) => {
            return flight.fetch('/api/connection/1/submit', {
                method: 'POST',
                auth: {
                    bearer: layerToken,
                },
                body: {
                    type: 'FeatureCollection',
                    schema: 'incident',
                    features: [{
                        id: 'incident-1',
                        type: 'Feature',
                        properties: { type: 'a-f-G', stale: 3600, metadata: { title: `Fire ${i}`, address: '1 Main St', number: 1, severity: 2 } },
                        geometry: { type: 'Point', coordinates: [-105.5, 39.5] },
                    }, {
                        id: 'incident-9',
                        type: 'Feature',
                        properties: { type: 'a-f-G', stale: 3600, metadata: { title: `Landslide ${i}`, address: '', number: 9, severity: 1 } },
                        geometry: { type: 'Point', coordinates: [-106, 39] },
                    }],
                },
            }, true);
        }));

        for (const res of responses) {
            assert.equal(res.status, 200);
            assert.deepEqual(res.body.errors, []);
            assert.equal(res.body.events, 2);
        }

        const events = await flight.config!.pg.select().from(CoreEvent);
        assert.equal(events.length, before.length + 1);
        assert.equal(events.filter(e => e.external_id === 'inc-9').length, 1);

        // An UPSERT keeps the identity of the existing Event
        const updated = events.find(e => e.external_id === 'inc-1')!;
        assert.equal(updated.id, fire.id);
        assert.equal(updated.created, fire.created);
        assert.match(updated.name, /^Fire \d$/);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - channels, style, links, active & Device assignment', async () => {
    try {
        const models = flight.config!.models;

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'dispatch',
            destination: LayerMapping_Destination.COREEVENT,
            name: 'Calls',
            query: 'properties.metadata.kind = "call"',
            mapping: {
                name: '{{title}}',
                type: '10031000001211000000',
                priority: '{{severity}}',
                active: '{{open}}',
                external_id: 'call-{{number}}',
                channels: [3, 7],
                style: { 'marker-color': '#ff0000', 'marker-opacity': '{{opacity}}' },
                links: [{ name: 'CAD {{number}}', url: 'https://cad.example.com/{{number}}' }],
            },
        });

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'dispatch',
            destination: LayerMapping_Destination.COREDEVICE,
            name: 'Units',
            query: 'properties.metadata.kind = "unit"',
            mapping: {
                name: '{{unit}}',
                type: '10031000001211000000',
                external_id: 'unit-{{unit}}',
                event_external_id: '{{#if call}}call-{{call}}{{/if}}',
                channels: [3],
            },
        });

        const submit = async (open: boolean, call: number | null) => {
            const res = await flight.fetch('/api/connection/1/submit', {
                method: 'POST',
                auth: {
                    bearer: layerToken,
                },
                body: {
                    type: 'FeatureCollection',
                    schema: 'dispatch',
                    // The Device precedes the Event it is assigned to
                    features: [{
                        id: 'e1',
                        type: 'Feature',
                        properties: { metadata: { kind: 'unit', unit: 'E1', call } },
                        geometry: null,
                    }, {
                        id: 'c1',
                        type: 'Feature',
                        properties: { metadata: { kind: 'call', title: 'Structure Fire', severity: 'High', open: String(open), opacity: '0.5', number: 77 } },
                        geometry: { type: 'Point', coordinates: [-105, 39] },
                    }],
                },
            }, true);

            assert.equal(res.status, 200);
            assert.deepEqual(res.body.errors, []);
            assert.equal(res.body.events, 1);
            assert.equal(res.body.devices, 1);

            const [event] = (await flight.config!.pg.select().from(CoreEvent)).filter(e => e.external_id === 'call-77');
            const [device] = (await flight.config!.pg.select().from(CoreDevice)).filter(d => d.external_id === 'unit-E1');

            return { event, device };
        };

        const opened = await submit(true, 77);

        assert.equal(opened.event.priority, 'high');
        assert.equal(opened.event.active, true);
        assert.equal(opened.event.ended, null);
        assert.deepEqual(opened.event.style, { 'marker-color': '#ff0000', 'marker-opacity': 0.5 });
        assert.deepEqual(opened.event.links, [{ name: 'CAD 77', url: 'https://cad.example.com/77' }]);
        assert.equal(opened.device.event, opened.event.id);

        const augmented = await models.CoreEvent.augmented_from(opened.event.id);
        assert.deepEqual(augmented.channels, [3, 7]);
        assert.deepEqual((await models.CoreDevice.augmented_from(opened.device.id)).channels, [3]);

        const closed = await submit(false, null);

        assert.equal(closed.event.id, opened.event.id);
        assert.equal(closed.event.active, false);
        assert.ok(closed.event.ended, 'closing an Event stamps ended');
        assert.equal(closed.device.event, null, 'an empty event_external_id unassigns the Device');
        assert.deepEqual((await models.CoreEvent.augmented_from(closed.event.id)).channels, [3, 7]);

        const reclosed = await submit(false, null);
        assert.equal(reclosed.event.ended, closed.event.ended, 'the original end time is preserved');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - update: false fields are only applied when the record is created', async () => {
    try {
        const models = flight.config!.models;

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'hydrant',
            destination: LayerMapping_Destination.COREEVENT,
            name: 'Hydrants',
            query: null,
            mapping: {
                name: { value: '{{title}}', update: false },
                type: '10031000001211000000',
                remarks: '{{notes}}',
                active: { value: '{{open}}', update: false },
                channels: { value: [3], update: false },
                style: {
                    'icon': { value: 'abc:Fire/hydrant.png', update: false },
                    'marker-color': '{{colour}}',
                },
            },
        });

        const submit = async (metadata: Record<string, unknown>) => {
            const res = await flight.fetch('/api/connection/1/submit', {
                method: 'POST',
                auth: {
                    bearer: layerToken,
                },
                body: {
                    type: 'FeatureCollection',
                    schema: 'hydrant',
                    features: [{
                        id: 'hydrant-1',
                        type: 'Feature',
                        properties: { metadata },
                        geometry: { type: 'Point', coordinates: [-105, 39] },
                    }],
                },
            }, true);

            assert.equal(res.status, 200);
            assert.deepEqual(res.body.errors, []);

            const [event] = (await flight.config!.pg.select().from(CoreEvent)).filter(e => e.external_id === 'hydrant-1');
            return event;
        };

        const created = await submit({ title: 'Hydrant', notes: 'Installed', open: 'true', colour: '#0000ff' });

        assert.equal(created.name, 'Hydrant');
        assert.deepEqual(created.style, { 'icon': 'abc:Fire/hydrant.png', 'marker-color': '#0000ff' });

        // A user renames the Event, closes it, restyles it & shares it with another Channel
        await models.CoreEvent.commit(created.id, {
            name: 'Hydrant (Main St)',
            active: false,
            ended: '2026-01-01T00:00:00.000Z',
            style: { 'icon': 'abc:Fire/custom.png', 'marker-color': '#0000ff', 'marker-opacity': 0.5 },
        });
        await flight.config!.pg.insert(CoreEventChannel).values({ event: created.id, channel: BigInt(9) });

        const updated = await submit({ title: 'Hydrant Renamed Upstream', notes: 'Flow tested', open: 'true', colour: '#00ff00' });

        assert.equal(updated.id, created.id);
        assert.equal(updated.remarks, 'Flow tested', 'fields update by default');
        assert.equal(updated.name, 'Hydrant (Main St)');
        assert.equal(updated.active, false);
        assert.ok(updated.ended, 'ended is derived from a create only active so is left alone');
        assert.deepEqual(updated.style, { 'icon': 'abc:Fire/custom.png', 'marker-color': '#00ff00', 'marker-opacity': 0.5 });
        assert.deepEqual((await models.CoreEvent.augmented_from(created.id)).channels, [3, 9]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/submit - a CoreEvent map that cannot produce a type is reported per feature', async () => {
    try {
        const models = flight.config!.models;

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'alert',
            destination: LayerMapping_Destination.COREEVENT,
            name: 'No Type',
            query: null,
            mapping: { remarks: '{{text}}' },
        });

        const res = await flight.fetch('/api/connection/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                type: 'FeatureCollection',
                schema: 'alert',
                features: [{
                    id: 'alert-1',
                    type: 'Feature',
                    properties: { type: 'a-f-G', stale: 3600, metadata: { text: 'Hello' } },
                    geometry: { type: 'Point', coordinates: [-105, 39] },
                }, {
                    id: 'alert-2',
                    type: 'Feature',
                    properties: { metadata: { text: 'No geometry' } },
                }],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.submitted, 1);
        assert.equal(res.body.events, 0);
        assert.equal(res.body.errors.length, 2);
        assert.equal(res.body.errors[0].error, 'CoreEvent Map did not produce: type');
        assert.equal(res.body.errors[0].feature.id, 'alert-1');
        assert.equal(res.body.errors[1].error, 'CoreEvent requires a Feature geometry');
        assert.equal(res.body.errors[1].feature.id, 'alert-2');
        assert.equal(res.body.skipped.length, 1);
        assert.equal(res.body.skipped[0].feature.id, 'alert-2');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
