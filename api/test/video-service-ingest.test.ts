import test from 'node:test';
import assert from 'node:assert';
import { ingestSource } from '../stateless/lib/control/video-service.js';

test('ingestSource: no-op when internalHost is not set', () => {
    const source = 'rtsp://video.example.org:8554/mystream';
    assert.equal(ingestSource(source, 'video.example.org', undefined), source);
});

test('ingestSource: rewrites an RTSP source matching our own hostname when opted in', () => {
    const rewritten = ingestSource('rtsp://video.example.org:8554/mystream', 'video.example.org', 'mediamtx');
    assert.equal(rewritten, 'rtsp://mediamtx:8554/mystream');
});

test('ingestSource: leaves RTSP sources pointing elsewhere untouched', () => {
    const source = 'rtsp://camera.example.net:8554/mystream';
    assert.equal(ingestSource(source, 'video.example.org', 'mediamtx'), source);
});

test('ingestSource: leaves non-RTSP sources untouched even on a hostname match', () => {
    const source = 'https://video.example.org/stream.m3u8';
    assert.equal(ingestSource(source, 'video.example.org', 'mediamtx'), source);
});

test('ingestSource: passes through unparseable sources unchanged', () => {
    assert.equal(ingestSource('not a url', 'video.example.org', 'mediamtx'), 'not a url');
});

test('ingestSource: passes through a missing source unchanged', () => {
    assert.equal(ingestSource(null, 'video.example.org', 'mediamtx'), null);
    assert.equal(ingestSource(undefined, 'video.example.org', 'mediamtx'), undefined);
});
