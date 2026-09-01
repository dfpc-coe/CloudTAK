import test from 'node:test';
import assert from 'node:assert';
import jwt from 'jsonwebtoken';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

const layerToken = 'etl.' + jwt.sign({ access: 'layer', id: 1, internal: true }, 'coe-wildland-fire');

let eventMapId: string;

test('Setup: Create Layer', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Layer Map Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
            permissions: ['event:*', 'device:*'],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1/map - empty', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/map', {
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

test('POST: api/connection/1/layer/1/map - invalid JSONata query', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/map', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Broken Map',
                query: 'reports.{',
                type: 'CoreEvent',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(res.body.message.startsWith('Invalid JSONata Query'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer/1/map - CoreEvent Map', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/map', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Report Events',
                query: 'reports.{ "name": title, "external_id": id, "geometry": { "type": "Point", "coordinates": [lon, lat] } }',
                type: 'CoreEvent',
                mapping: {
                    type: '10031000001213000000',
                    priority: 'high',
                    remarks: 'Created by Layer Map',
                },
            },
        }, true);

        assert.equal(res.body.layer, 1);
        assert.equal(res.body.name, 'Report Events');
        assert.equal(res.body.type, 'CoreEvent');
        assert.equal(res.body.enabled, true);

        eventMapId = res.body.id;
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/1/submit - requires resource token', async () => {
    try {
        const res = await flight.fetch('/api/layer/1/submit', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                reports: [],
            },
        }, false);

        assert.equal(res.status, 401);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/1/submit - create Core Events', async () => {
    try {
        const res = await flight.fetch('/api/layer/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                reports: [{
                    id: 'ext-1',
                    title: 'Fast Moving Fire',
                    lon: -105.2705,
                    lat: 40.015,
                }, {
                    id: 'ext-2',
                    title: 'Slow Moving Fire',
                    lon: -106.2705,
                    lat: 41.015,
                }],
            },
        }, true);

        assert.equal(res.body.status, 200);
        assert.equal(res.body.errors.length, 0);
        assert.equal(res.body.results.length, 1);
        assert.equal(res.body.results[0].map, eventMapId);
        assert.equal(res.body.results[0].type, 'CoreEvent');
        assert.equal(res.body.results[0].count, 2);

        const list = await flight.fetch('/api/core/event?sort=external_id&order=asc', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 2);
        assert.equal(list.body.items[0].name, 'Fast Moving Fire');
        assert.equal(list.body.items[0].external_id, 'ext-1');
        assert.equal(list.body.items[0].type, '10031000001213000000');
        assert.equal(list.body.items[0].priority, 'high');
        assert.equal(list.body.items[0].remarks, 'Created by Layer Map');
        assert.equal(list.body.items[0].connection, 1);
        assert.deepEqual(list.body.items[0].geometry, {
            type: 'Point',
            coordinates: [-105.2705, 40.015],
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/1/submit - upsert Core Event by external_id', async () => {
    try {
        const res = await flight.fetch('/api/layer/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                reports: [{
                    id: 'ext-1',
                    title: 'Contained Fire',
                    lon: -105.2705,
                    lat: 40.015,
                }],
            },
        }, true);

        assert.equal(res.body.results[0].count, 1);

        const list = await flight.fetch('/api/core/event?filter=Fire', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 2);
        assert.ok(list.body.items.some((item: { name: string }) => item.name === 'Contained Fire'));
        assert.ok(!list.body.items.some((item: { name: string }) => item.name === 'Fast Moving Fire'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/1/submit - invalid query output reported per record', async () => {
    try {
        const res = await flight.fetch('/api/layer/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                reports: [{
                    id: 'ext-3',
                    lon: -105.2705,
                    lat: 40.015,
                }],
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.errors.length, 1);
        assert.equal(res.body.errors[0].map, eventMapId);
        assert.ok(res.body.errors[0].error.startsWith('Query output is not a valid Core Event'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer/1/map - CoreDevice Map', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/map', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Drone Devices',
                query: 'drones.{ "name": callsign, "external_id": serial, "serial": serial, "battery": battery }',
                type: 'CoreDevice',
                mapping: {
                    type: '10031000001213000000',
                    manufacturer: 'DJI',
                    model: 'Mavic 3',
                },
            },
        }, true);

        assert.equal(res.body.type, 'CoreDevice');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/1/submit - create Core Device', async () => {
    try {
        const res = await flight.fetch('/api/layer/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                drones: [{
                    callsign: 'Drone 1',
                    serial: 'DJI-123',
                    battery: 88,
                }],
            },
        }, true);

        assert.equal(res.body.errors.length, 0);
        assert.equal(res.body.results.length, 2);

        const device = res.body.results.find((r: { type: string }) => r.type === 'CoreDevice');
        assert.equal(device.count, 1);

        const list = await flight.fetch('/api/core/device', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].name, 'Drone 1');
        assert.equal(list.body.items[0].manufacturer, 'DJI');
        assert.equal(list.body.items[0].model, 'Mavic 3');
        assert.equal(list.body.items[0].serial, 'DJI-123');
        assert.equal(list.body.items[0].battery, 88);
        assert.equal(list.body.items[0].external_id, 'DJI-123');
        assert.equal(list.body.items[0].connection, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1/map/:mapid - disable Map', async () => {
    try {
        const res = await flight.fetch(`/api/connection/1/layer/1/map/${eventMapId}`, {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                enabled: false,
            },
        }, true);

        assert.equal(res.body.enabled, false);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/1/submit - disabled Maps are skipped', async () => {
    try {
        const res = await flight.fetch('/api/layer/1/submit', {
            method: 'POST',
            auth: {
                bearer: layerToken,
            },
            body: {
                reports: [{
                    id: 'ext-9',
                    title: 'Skipped Fire',
                    lon: -105,
                    lat: 40,
                }],
            },
        }, true);

        assert.equal(res.body.results.length, 1);
        assert.equal(res.body.results[0].type, 'CoreDevice');
        assert.equal(res.body.results[0].count, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/connection/1/layer/1/map/:mapid', async () => {
    try {
        const res = await flight.fetch(`/api/connection/1/layer/1/map/${eventMapId}`, {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.message, 'Map Deleted');

        const list = await flight.fetch('/api/connection/1/layer/1/map', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

const scopedLayerToken = 'etl.' + jwt.sign({ access: 'layer', id: 2, internal: true }, 'coe-wildland-fire');

test('Setup: Create Scoped Layer', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Scoped Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
            permissions: ['event:create'],
        });

        for (const body of [{
            name: 'Scoped Events',
            query: 'reports.{ "name": title, "external_id": id, "geometry": { "type": "Point", "coordinates": [lon, lat] } }',
            type: 'CoreEvent',
            mapping: { type: '10031000001213000000' },
        }, {
            name: 'Scoped Devices',
            query: 'drones.{ "name": callsign }',
            type: 'CoreDevice',
            mapping: { type: '10031000001213000000' },
        }, {
            name: 'Scoped Features',
            query: 'features',
            type: 'CoreFeature',
            mapping: {},
        }]) {
            await flight.fetch('/api/connection/1/layer/2/map', {
                method: 'POST',
                auth: {
                    bearer: flight.token.admin,
                },
                body,
            }, true);
        }
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/2/submit - event:create permits creating Events', async () => {
    try {
        const res = await flight.fetch('/api/layer/2/submit', {
            method: 'POST',
            auth: {
                bearer: scopedLayerToken,
            },
            body: {
                reports: [{
                    id: 'scoped-1',
                    title: 'Scoped Fire',
                    lon: -105,
                    lat: 40,
                }],
            },
        }, true);

        const event = res.body.results.find((r: { type: string }) => r.type === 'CoreEvent');
        assert.equal(event.count, 1);
        assert.ok(!res.body.errors.some((e: { error: string }) => e.error.includes('event:')));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/2/submit - upsert without event:update exceeds scope', async () => {
    try {
        const res = await flight.fetch('/api/layer/2/submit', {
            method: 'POST',
            auth: {
                bearer: scopedLayerToken,
            },
            body: {
                reports: [{
                    id: 'scoped-1',
                    title: 'Scoped Fire Update',
                    lon: -105,
                    lat: 40,
                }],
            },
        }, false);

        assert.equal(res.status, 400);

        const err = res.body.errors.find((e: { name: string }) => e.name === 'Scoped Events');
        assert.equal(err.error, 'Updating Core Event scoped-1 exceeds Layer permissions - the event:update permission is required');

        const event = res.body.results.find((r: { type: string }) => r.type === 'CoreEvent');
        assert.equal(event.count, 0);

        const list = await flight.fetch('/api/core/event?filter=Scoped', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 1);
        assert.equal(list.body.items[0].name, 'Scoped Fire');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/2/submit - CoreDevice Map without device permissions exceeds scope', async () => {
    try {
        const res = await flight.fetch('/api/layer/2/submit', {
            method: 'POST',
            auth: {
                bearer: scopedLayerToken,
            },
            body: {
                drones: [{
                    callsign: 'Scoped Drone',
                }],
            },
        }, false);

        assert.equal(res.status, 400);

        const err = res.body.errors.find((e: { name: string }) => e.name === 'Scoped Devices');
        assert.equal(err.error, 'Map exceeds Layer permissions - the Layer does not have the device:create or device:update permission');

        const list = await flight.fetch('/api/core/device?filter=Scoped', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(list.body.total, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/layer/2/submit - CoreFeature Map without feature:submit exceeds scope', async () => {
    try {
        const res = await flight.fetch('/api/layer/2/submit', {
            method: 'POST',
            auth: {
                bearer: scopedLayerToken,
            },
            body: {
                features: [{
                    id: 'feature-1',
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'Point',
                        coordinates: [-105, 40],
                    },
                }],
            },
        }, false);

        assert.equal(res.status, 400);

        const err = res.body.errors.find((e: { name: string }) => e.name === 'Scoped Features');
        assert.equal(err.error, 'Map exceeds Layer permissions - the Layer does not have the feature:submit permission');
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
