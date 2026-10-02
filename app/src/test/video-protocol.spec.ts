import { describe, it, expect } from 'vitest';
import {
    isHlsSource,
    playbackOrder,
    splitCredentials,
    whepUrl
} from '../components/util/video/protocol.ts';

const protocols = {
    hls: { name: 'HLS', url: 'https://media.example.com:9997/stream/abc/index.m3u8' },
    webrtc: { name: 'WebRTC', url: 'https://media.example.com:8889/abc' },
    rtsp: { name: 'RTSP', url: 'rtsp://media.example.com:8554/abc' },
};

describe('isHlsSource', () => {
    it('detects http(s) proxy sources', () => {
        expect(isHlsSource('https://cam.example.com/live/index.m3u8')).toBe(true);
        expect(isHlsSource('http://cam.example.com/live/index.m3u8')).toBe(true);
    });

    it('rejects non-http sources & missing values', () => {
        expect(isHlsSource('rtsp://cam.example.com/live')).toBe(false);
        expect(isHlsSource('srt://cam.example.com:8890?streamid=read:abc')).toBe(false);
        expect(isHlsSource('not a url')).toBe(false);
        expect(isHlsSource(null)).toBe(false);
        expect(isHlsSource(undefined)).toBe(false);
    });
});

describe('playbackOrder', () => {
    it('defaults to WebRTC with an HLS fallback for non-HLS sources', () => {
        expect(playbackOrder(protocols, 'rtsp://cam.example.com/live')).toEqual(['webrtc', 'hls']);
        expect(playbackOrder(protocols, null)).toEqual(['webrtc', 'hls']);
    });

    it('defaults to HLS with a WebRTC fallback for proxied HLS sources', () => {
        expect(playbackOrder(protocols, 'https://cam.example.com/live/index.m3u8')).toEqual(['hls', 'webrtc']);
    });

    it('omits protocols the media server does not offer', () => {
        expect(playbackOrder({ hls: protocols.hls }, 'rtsp://cam.example.com/live')).toEqual(['hls']);
        expect(playbackOrder({ webrtc: protocols.webrtc }, 'https://cam.example.com/index.m3u8')).toEqual(['webrtc']);
        expect(playbackOrder({ rtsp: protocols.rtsp }, null)).toEqual([]);
        expect(playbackOrder(undefined, null)).toEqual([]);
    });

    it('omits WebRTC when the browser does not support it', () => {
        expect(playbackOrder(protocols, null, false)).toEqual(['hls']);
    });
});

describe('splitCredentials', () => {
    it('extracts embedded credentials and strips them from the URL', () => {
        expect(splitCredentials('https://user:p%40ss@media.example.com:8889/abc')).toEqual({
            url: 'https://media.example.com:8889/abc',
            username: 'user',
            password: 'p@ss',
        });
    });

    it('ignores unpopulated credential templates', () => {
        const { url, username, password } = splitCredentials('https://{{username}}:{{password}}@media.example.com:8889/abc');
        expect(url).toBe('https://media.example.com:8889/abc');
        expect(username).toBe('');
        expect(password).toBe('');
    });

    it('returns empty credentials when none are present', () => {
        expect(splitCredentials('https://media.example.com:8889/abc')).toEqual({
            url: 'https://media.example.com:8889/abc',
            username: '',
            password: '',
        });
    });
});

describe('whepUrl', () => {
    it('appends the MediaMTX WHEP endpoint', () => {
        expect(whepUrl('https://media.example.com:8889/abc')).toBe('https://media.example.com:8889/abc/whep');
        expect(whepUrl('https://media.example.com:8889/abc/')).toBe('https://media.example.com:8889/abc/whep');
    });
});
