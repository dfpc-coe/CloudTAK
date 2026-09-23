import test from 'node:test';
import assert from 'node:assert';
import Flight from './flight.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

test('Setup: Create Layer', async () => {
    try {
        const layer = await flight.config!.models.Layer.generate({
            name: 'Ephemeral Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
        });

        await flight.config!.models.LayerIncoming.generate({ layer: layer.id });
        await flight.config!.models.LayerOutgoing.generate({ layer: layer.id });
    } catch (err) {
        assert.ifError(err);
    }
});

for (const flow of ['incoming', 'outgoing']) {
    test(`PUT: api/connection/1/layer/1/${flow}/ephemeral - nested values round trip`, async () => {
        try {
            const ephemeral = {
                token: 'abc',
                channels: { 'event-1': 'C0123', 'event-2': 'C0456' },
                seen: [1, 2, 3],
                cursor: 42,
            };

            const res = await flight.fetch(`/api/connection/1/layer/1/${flow}/ephemeral`, {
                method: 'PUT',
                auth: { bearer: flight.token.admin },
                body: ephemeral,
            }, true);

            assert.deepEqual(res.body, ephemeral);

            const layer = await flight.fetch('/api/connection/1/layer/1', {
                method: 'GET',
                auth: { bearer: flight.token.admin },
            }, true);

            assert.deepEqual(layer.body[flow].ephemeral, ephemeral);
        } catch (err) {
            assert.ifError(err);
        }
    });
}

flight.landing();
