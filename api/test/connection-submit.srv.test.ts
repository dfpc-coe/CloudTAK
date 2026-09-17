import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';
import { ConnectionFeature, CoreEvent, CoreDevice } from '../common/schema.js';
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
