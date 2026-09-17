import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';
import { LayerMapping_Destination } from '../common/enums.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

test('Setup: Create Layer with Incoming config', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Mapping Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
        });

        await flight.config!.models.LayerIncoming.generate({
            layer: 1,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1 - incoming maps default to an empty list', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.incoming.maps, []);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1 - maps grouped by schema & destination with queries in insertion order', async () => {
    try {
        const models = flight.config!.models;

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'unit',
            destination: LayerMapping_Destination.COREFEATURE,
            name: 'Callsign',
            query: null,
            mapping: { callsign: 'unit.name' },
        });

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'unit',
            destination: LayerMapping_Destination.COREFEATURE,
            name: 'Offline Units',
            query: 'status = "offline"',
            mapping: { stale: 3600 },
        });

        await models.LayerMapping.generate({
            layer: 1,
            schema: 'incident',
            destination: LayerMapping_Destination.COREEVENT,
            name: 'Summary',
            query: null,
            mapping: { title: 'incident.summary' },
        });

        const res = await flight.fetch('/api/connection/1/layer/1', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.incoming.maps, [{
            schema: 'incident',
            destination: 'CoreEvent',
            queries: [{
                id: 3,
                name: 'Summary',
                query: null,
                map: { title: 'incident.summary' },
            }],
        }, {
            schema: 'unit',
            destination: 'CoreFeature',
            queries: [{
                id: 1,
                name: 'Callsign',
                query: null,
                map: { callsign: 'unit.name' },
            }, {
                id: 2,
                name: 'Offline Units',
                query: 'status = "offline"',
                map: { stale: 3600 },
            }],
        }]);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1/incoming - response carries maps', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                enabled_styles: true,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.enabled_styles, true);
        assert.equal(res.body.maps.length, 2);
        assert.equal(res.body.maps[1].schema, 'unit');
    } catch (err) {
        assert.ifError(err);
    }
});

test('Layer delete cascades to its maps', async () => {
    try {
        await flight.config!.models.LayerIncoming.delete(1);
        await flight.config!.models.Layer.delete(1);

        const remaining = await flight.config!.models.LayerMapping.count();

        assert.equal(Number(remaining), 0);
    } catch (err) {
        assert.ifError(err);
    }
});

flight.landing();
