import test from 'node:test';
import assert from 'node:assert';
import Sinon from 'sinon';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { setTimeout as delay } from 'node:timers/promises';
import Flight from './flight.js';
import ETLEvents from '../common/etl-events.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();
flight.connection();

type Delivered = {
    queue: string;
    group: string;
    body: {
        type: string;
        action: string;
        channels: number[];
        data: Record<string, unknown>;
    };
};

const delivered: Delivered[] = [];

async function waitFor(count: number): Promise<void> {
    for (let i = 0; i < 50 && delivered.length < count; i++) await delay(50);

    // The API response schema strips the bbox the geometry column carries
    for (const message of delivered) {
        delete (message.body.data.geometry as Record<string, unknown>).bbox;
    }
}

let eventId: string;

test('ETLEvents: setup subscribed Outgoing Layers', async () => {
    try {
        flight.config!.noetlevents = false;
        flight.config!.arnPrefix = 'arn:aws:sqs:us-east-1:123456789012';

        Sinon.stub(SQSClient.prototype, 'send').callsFake((command) => {
            if (!(command instanceof SendMessageBatchCommand)) throw new Error('Unexpected SQS command');

            for (const entry of command.input.Entries || []) {
                delivered.push({
                    queue: command.input.QueueUrl!,
                    group: entry.MessageGroupId!,
                    body: JSON.parse(entry.MessageBody!),
                });
            }

            return Promise.resolve({ Successful: [], Failed: [] });
        });

        Sinon.stub(ETLEvents.prototype, 'connectionChannels').callsFake(async (connection) => {
            assert.equal(connection, 1);
            return new Set([7, 99]);
        });

        for (const [name, subscriptions] of [
            ['All Events Layer', ['feature:*', 'event:*']],
            ['Created Events Layer', ['event:create']],
            ['Features Only Layer', ['feature:*']],
            ['Unsubscribed Layer', []],
        ] as Array<[string, string[]]>) {
            const layer = await flight.config!.models.Layer.generate({
                name,
                task: 'test-task-v1.0.0',
                connection: 1,
            });

            await flight.config!.models.LayerOutgoing.generate({
                layer: layer.id,
                subscriptions,
            });
        }

        await flight.config!.models.Layer.commit(4, { enabled: false });
        await flight.config!.models.LayerOutgoing.commit(4, { subscriptions: ['event:*'] });
    } catch (err) {
        assert.ifError(err);
    }
});

test('ETLEvents: event:create is delivered with the shared Channels', async () => {
    try {
        const res = await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Wildfire Report',
                type: '10031000001213000000',
                geometry: { type: 'Point', coordinates: [-105.2705, 40.015] },
                channels: [7, 42],
            },
        }, true);

        eventId = res.body.id;

        await waitFor(2);

        assert.deepEqual(delivered.map(d => d.queue).sort(), [
            'https://sqs.us-east-1.amazonaws.com/123456789012/test-layer-1-outgoing.fifo',
            'https://sqs.us-east-1.amazonaws.com/123456789012/test-layer-2-outgoing.fifo',
        ]);

        for (const message of delivered) {
            assert.equal(message.group, `${message.queue.includes('layer-1') ? 1 : 2}-${eventId}`);
            assert.deepEqual(message.body, {
                type: 'event',
                action: 'create',
                channels: [7],
                data: res.body,
            });
        }
    } catch (err) {
        assert.ifError(err);
    }
});

test('ETLEvents: event:update only reaches Layers subscribed to it', async () => {
    try {
        delivered.length = 0;

        const res = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: { remarks: 'Fire is spreading' },
        }, true);

        await waitFor(1);
        await delay(200);

        assert.equal(delivered.length, 1);
        assert.equal(delivered[0].queue, 'https://sqs.us-east-1.amazonaws.com/123456789012/test-layer-1-outgoing.fifo');
        assert.deepEqual(delivered[0].body, {
            type: 'event',
            action: 'update',
            channels: [7],
            data: res.body,
        });
        assert.equal(delivered[0].body.data.remarks, 'Fire is spreading');
    } catch (err) {
        assert.ifError(err);
    }
});

test('ETLEvents: a PATCH that changes nothing is not delivered', async () => {
    try {
        delivered.length = 0;

        await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'PATCH',
            auth: { bearer: flight.token.admin },
            body: {},
        }, true);

        await delay(200);

        assert.equal(delivered.length, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('ETLEvents: event:delete carries the deleted Event', async () => {
    try {
        delivered.length = 0;

        const before = await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'GET',
            auth: { bearer: flight.token.admin },
        }, true);

        await flight.fetch(`/api/core/event/${eventId}`, {
            method: 'DELETE',
            auth: { bearer: flight.token.admin },
        }, true);

        await waitFor(1);
        await delay(200);

        assert.equal(delivered.length, 1);
        assert.deepEqual(delivered[0].body, {
            type: 'event',
            action: 'delete',
            channels: [7],
            data: before.body,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('ETLEvents: an Event sharing no Channel with the Connection is not delivered', async () => {
    try {
        delivered.length = 0;

        await flight.fetch('/api/core/event', {
            method: 'POST',
            auth: { bearer: flight.token.admin },
            body: {
                name: 'Private Report',
                type: '10031000001213000000',
                geometry: { type: 'Point', coordinates: [-105.2705, 40.015] },
                channels: [42],
            },
        }, true);

        await delay(200);

        assert.equal(delivered.length, 0);
    } catch (err) {
        assert.ifError(err);
    }
});

test('ETLEvents: teardown', async () => {
    Sinon.restore();
});

flight.landing();
