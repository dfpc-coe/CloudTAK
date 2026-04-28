import test from 'node:test';
import assert from 'node:assert';
import Err from '@openaddresses/batch-error';
import { toError, toErr } from '../lib/error.js';

test('toError returns existing Error instances', () => {
    const err = new Error('Existing');

    assert.equal(toError(err), err);
});

test('toError wraps unknown values', () => {
    assert.equal(toError('Boom').message, 'Boom');
    assert.equal(toError(null).message, 'null');
});

test('toErr returns existing Err instances', () => {
    const err = new Err(400, null, 'Bad Request', false);

    assert.equal(toErr(err), err);
});

test('toErr wraps status errors', () => {
    const err = Object.assign(new Error('Not Found'), {
        status: 404,
        safe: 'Missing Item'
    });
    const wrapped = toErr(err);

    assert.equal(wrapped.status, 404);
    assert.equal(wrapped.safe, 'Missing Item');
    assert.equal(wrapped.message, 'Not Found');
});

test('toErr allows status and safe overrides', () => {
    const wrapped = toErr('Invalid Input', 400, 'Invalid Input', false);

    assert.equal(wrapped.status, 400);
    assert.equal(wrapped.safe, 'Invalid Input');
    assert.equal(wrapped.message, 'Invalid Input');
});