import assert from 'node:assert/strict';
import { test } from 'vitest';
import { stdurl } from './std.ts';

test('stdurl keeps local WebSocket traffic on the current origin', () => {
    const url = stdurl('/api');

    assert.equal(url.hostname, 'localhost');
    assert.equal(url.port, '8080');
    assert.equal(url.pathname, '/api');
});

test('stdurl keeps normal local API traffic on the current origin', () => {
    const url = stdurl('/api/profile');

    assert.equal(url.hostname, 'localhost');
    assert.equal(url.port, '8080');
    assert.equal(url.pathname, '/api/profile');
});

test('stdurl keeps production WebSocket traffic on the current origin', () => {
    const url = stdurl('https://map.example.com/api');

    assert.equal(url.hostname, 'map.example.com');
    assert.equal(url.port, '');
    assert.equal(url.pathname, '/api');
});

