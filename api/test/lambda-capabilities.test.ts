import test from 'node:test';
import assert from 'node:assert';
import Lambda from '../stateless/lib/aws/lambda.js';
import { InvocationType } from '@tak-ps/etl';

const base = {
    name: 'Test Task',
    version: '1.0.0',
};

const incoming = (schema: { input: unknown; output: unknown }) => ({
    invocation: [InvocationType.Manual],
    invocationDefaults: {},
    schema,
});

test('Lambda.normalizeCapabilities: single output schema is mapped to default', () => {
    const output = { type: 'object', properties: { name: { type: 'string' } } };

    const res = Lambda.normalizeCapabilities({
        ...base,
        incoming: incoming({ input: { type: 'object' }, output }),
    });

    assert.deepEqual(res.incoming?.schema.input, { type: 'object' });
    assert.deepEqual(res.incoming?.schema.output, [{ id: 'default', schema: output }]);
});

test('Lambda.normalizeCapabilities: named output schemas pass through', () => {
    const output = [
        { id: 'incident', schema: { type: 'object', properties: {} } },
        { id: 'unit', schema: { type: 'object', properties: {} } },
    ];

    const res = Lambda.normalizeCapabilities({
        ...base,
        incoming: incoming({ input: {}, output }),
        outgoing: { schema: { input: {}, output } },
    });

    assert.deepEqual(res.incoming?.schema.output, output);
    assert.deepEqual(res.outgoing?.schema.output, output);
});

test('Lambda.normalizeCapabilities: malformed named entries are dropped', () => {
    const res = Lambda.normalizeCapabilities({
        ...base,
        incoming: incoming({
            input: {},
            output: [
                { id: 'incident', schema: { type: 'object' } },
                { id: 123, schema: {} },
                { schema: {} },
                'nope',
                null,
            ],
        }),
    });

    assert.deepEqual(res.incoming?.schema.output, [{ id: 'incident', schema: { type: 'object' } }]);
});

test('Lambda.normalizeCapabilities: missing or errored output becomes an empty list', () => {
    const outputError = { status: 400, message: 'Schema failed' };

    const res = Lambda.normalizeCapabilities({
        ...base,
        incoming: incoming({ input: {}, output: null }),
        outgoing: { schema: { input: {}, output: undefined, outputError } },
    });

    assert.deepEqual(res.incoming?.schema.output, []);
    assert.deepEqual(res.outgoing?.schema.output, []);
    assert.deepEqual(res.outgoing?.schema.outputError, outputError);
});

test('Lambda.normalizeCapabilities: flows without schemas are untouched', () => {
    const res = Lambda.normalizeCapabilities({ ...base });

    assert.deepEqual(res, base);
});
