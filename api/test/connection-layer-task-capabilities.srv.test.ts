import test from 'node:test';
import assert from 'node:assert';
import Sinon from 'sinon';
import Flight from './flight.js';
import Lambda from '../stateless/lib/aws/lambda.js';

const flight = new Flight();

flight.init({ takserver: true });
flight.takeoff();
flight.user();

flight.connection();

test('Setup: Create Layer', async () => {
    try {
        await flight.config!.models.Layer.generate({
            name: 'Capabilities Layer',
            task: 'test-task-v1.0.0',
            connection: 1,
        });
    } catch (err) {
        assert.ifError(err);
    }
});

test('GET: api/connection/1/layer/1/task/capabilities - single schema mapped to default', async () => {
    try {
        Sinon.stub(Lambda, 'invoke').callsFake(async (config, layerid, type) => {
            assert.equal(layerid, 1);
            assert.equal(type, 'capabilities');

            return Buffer.from(JSON.stringify({
                name: 'TestTask',
                version: '1.0.0',
                incoming: {
                    invocation: ['schedule'],
                    invocationDefaults: {},
                    schema: {
                        input: { type: 'object', properties: { DEBUG: { type: 'boolean' } } },
                        output: { type: 'object', properties: { name: { type: 'string' } } },
                    },
                },
            }));
        });

        const res = await flight.fetch('/api/connection/1/layer/1/task/capabilities', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.incoming.schema.output, [{
            id: 'default',
            schema: { type: 'object', properties: { name: { type: 'string' } } },
        }]);
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

test('GET: api/connection/1/layer/1/task/capabilities - named schemas pass through', async () => {
    try {
        const output = [
            { id: 'incident', schema: { type: 'object', properties: { id: { type: 'string' } } } },
            { id: 'unit', schema: { type: 'object', properties: { callsign: { type: 'string' } } } },
        ];

        Sinon.stub(Lambda, 'invoke').resolves(Buffer.from(JSON.stringify({
            name: 'TestTask',
            version: '1.0.0',
            incoming: {
                invocation: ['schedule'],
                invocationDefaults: {},
                schema: {
                    input: {},
                    output,
                },
            },
            outgoing: {
                schema: {
                    input: {},
                    output: null,
                    outputError: { status: 400, message: 'Not supported' },
                },
            },
        })));

        const res = await flight.fetch('/api/connection/1/layer/1/task/capabilities', {
            method: 'GET',
            auth: {
                bearer: flight.token.admin,
            },
        }, true);

        assert.equal(res.status, 200);
        assert.deepEqual(res.body.incoming.schema.output, output);
        assert.deepEqual(res.body.outgoing.schema.output, []);
        assert.deepEqual(res.body.outgoing.schema.outputError, { status: 400, message: 'Not supported' });
    } catch (err) {
        assert.ifError(err);
    } finally {
        Sinon.restore();
    }
});

flight.landing();
