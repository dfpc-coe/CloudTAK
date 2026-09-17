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

        await flight.config!.models.Layer.generate({
            name: 'Other Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1/incoming/mapping - empty', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, { total: 0, items: [] });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/2/layer/1/incoming/mapping - layer does not belong to connection', async () => {
    try {
        const res = await flight.fetch('/api/connection/2/layer/1/incoming/mapping', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                schema: 'unit',
                name: 'Callsign',
                mapping: { callsign: 'unit.name' },
            },
        }, false);

        assert.notEqual(res.status, 200);
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer/2/incoming/mapping - layer has no incoming config', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/2/incoming/mapping', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                schema: 'unit',
                name: 'Callsign',
                mapping: { callsign: 'unit.name' },
            },
        }, false);

        assert.equal(res.status, 400);
        assert.equal(res.body.message, 'Layer does not have incoming config');
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer/1/incoming/mapping - invalid JSONata query', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                schema: 'unit',
                name: 'Broken',
                query: 'status = ',
                mapping: {},
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(res.body.message.startsWith('Invalid JSONata query'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer/1/incoming/mapping - invalid CoreFeature template', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                schema: 'unit',
                name: 'Broken Template',
                mapping: { callsign: '{{#if name}}' },
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(res.body.message.startsWith('Invalid Callsign Template'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer/1/incoming/mapping - invalid CoreEvent priority', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                schema: 'incident',
                destination: LayerMapping_Destination.COREEVENT,
                name: 'Bad Priority',
                mapping: { priority: 'urgent' },
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(res.body.message.startsWith('Invalid Priority: urgent'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer/1/incoming/mapping - defaults', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                schema: 'unit',
                name: 'Callsign',
                mapping: { callsign: 'unit.name' },
            },
        }, true);

        assert.equal(res.status, 200);
        assert.ok(res.body.created);
        assert.ok(res.body.updated);
        delete res.body.created;
        delete res.body.updated;

        assert.deepEqual(res.body, {
            id: 1,
            layer: 1,
            schema: 'unit',
            name: 'Callsign',
            destination: 'CoreFeature',
            query: null,
            mapping: { callsign: 'unit.name' },
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('POST: api/connection/1/layer/1/incoming/mapping - query & destination', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping', {
            method: 'POST',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                schema: 'incident',
                name: 'Summary',
                destination: 'CoreEvent',
                query: 'status = "open"',
                mapping: { name: '{{summary}}' },
            },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.id, 2);
        assert.equal(res.body.destination, 'CoreEvent');
        assert.equal(res.body.query, 'status = "open"');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1/incoming/mapping - list & filter', async () => {
    try {
        let res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.total, 2);
        assert.deepEqual(res.body.items.map((m: { id: number }) => m.id), [1, 2]);

        res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping?schema=incident', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, 2);

        res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping?destination=CoreFeature', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.body.total, 1);
        assert.equal(res.body.items[0].id, 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1/incoming/mapping/2', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping/2', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.id, 2);
        assert.equal(res.body.name, 'Summary');
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1/incoming/mapping/3 - not found', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping/3', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404);
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1/incoming/mapping/2', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping/2', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                name: 'Open Incidents',
                query: null,
                mapping: { name: '{{summary}}', priority: 'high' },
            },
        }, true);

        assert.equal(res.status, 200);
        assert.equal(res.body.id, 2);
        assert.equal(res.body.name, 'Open Incidents');
        assert.equal(res.body.query, null);
        assert.deepEqual(res.body.mapping, { name: '{{summary}}', priority: 'high' });
    } catch (err) {
        assert.ifError(err);
    }
});

test('PATCH: api/connection/1/layer/1/incoming/mapping/2 - invalid JSONata query', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping/2', {
            method: 'PATCH',
            auth: {
                bearer: flight.token.admin,
            },
            body: {
                query: '$foo(',
            },
        }, false);

        assert.equal(res.status, 400);
        assert.ok(res.body.message.startsWith('Invalid JSONata query'));
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/connection/1/layer/2/incoming/mapping/1 - mapping belongs to another layer', async () => {
    try {
        await flight.config!.models.LayerIncoming.generate({
            layer: 2,
        });

        const res = await flight.fetch('/api/connection/1/layer/2/incoming/mapping/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, false);

        assert.equal(res.status, 404);
        assert.equal(res.body.message, 'Mapping does not belong to this layer');
    } catch (err) {
        assert.ifError(err);
    }
});

test('DELETE: api/connection/1/layer/1/incoming/mapping/1', async () => {
    try {
        const res = await flight.fetch('/api/connection/1/layer/1/incoming/mapping/1', {
            method: 'DELETE',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body, {
            status: 200,
            message: 'Mapping Deleted',
        });

        const remaining = await flight.config!.models.LayerMapping.count();
        assert.equal(Number(remaining), 1);
    } catch (err) {
        assert.ifError(err);
    }
});

test('Layer delete cascades to its Mappings', async () => {
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
