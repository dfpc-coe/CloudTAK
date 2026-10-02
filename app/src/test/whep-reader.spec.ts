import { describe, it, expect } from 'vitest';
import WhepReader from '../components/util/video/WhepReader.ts';

const OFFER = [
    'v=0',
    'o=- 1 2 IN IP4 127.0.0.1',
    's=-',
    't=0 0',
    'a=ice-ufrag:abcd',
    'a=ice-pwd:efgh',
    'm=video 9 UDP/TLS/RTP/SAVPF 96',
    'a=mid:0',
    'a=rtpmap:96 H264/90000',
    'm=audio 9 UDP/TLS/RTP/SAVPF 111',
    'a=mid:1',
    'a=rtpmap:111 opus/48000/2',
    'a=fmtp:111 minptime=10;useinbandfec=1',
    '',
].join('\r\n');

describe('WhepReader.linkToIceServers', () => {
    it('parses STUN & TURN servers from Link headers', () => {
        const servers = WhepReader.linkToIceServers(
            '<stun:stun.l.google.com:19302>; rel="ice-server", <turn:turn.example.com:3478>; rel="ice-server"; username="user"; credential="pa\\"ss"; credential-type="password"'
        );

        expect(servers).toEqual([
            { urls: ['stun:stun.l.google.com:19302'] },
            { urls: ['turn:turn.example.com:3478'], username: 'user', credential: 'pa"ss' },
        ]);
    });

    it('returns no servers without a Link header', () => {
        expect(WhepReader.linkToIceServers(null)).toEqual([]);
    });
});

describe('WhepReader.parseOffer', () => {
    it('extracts ICE credentials and media sections', () => {
        expect(WhepReader.parseOffer(OFFER)).toEqual({
            iceUfrag: 'abcd',
            icePwd: 'efgh',
            medias: ['video 9 UDP/TLS/RTP/SAVPF 96', 'audio 9 UDP/TLS/RTP/SAVPF 111'],
        });
    });
});

describe('WhepReader.editOffer', () => {
    it('enables stereo opus', () => {
        const sdp = WhepReader.editOffer(OFFER, []);
        expect(sdp).toContain('a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1');
        expect(sdp).not.toContain('PCMA/8000/2');
    });

    it('adds non-advertised codecs with free payload types', () => {
        const sdp = WhepReader.editOffer(OFFER, ['pcma/8000/2', 'L16/48000/2']);
        expect(sdp).toMatch(/m=audio 9 UDP\/TLS\/RTP\/SAVPF 111 30 31 32 33 34/);
        expect(sdp).toContain('a=rtpmap:30 PCMU/8000/2');
        expect(sdp).toContain('a=rtpmap:31 PCMA/8000/2');
        expect(sdp).toContain('a=rtpmap:34 L16/48000/2');
        expect(sdp).not.toContain('multiopus');
    });
});

describe('WhepReader.generateSdpFragment', () => {
    it('groups trickle candidates by media section', () => {
        const frag = WhepReader.generateSdpFragment(WhepReader.parseOffer(OFFER), [
            { sdpMLineIndex: 1, candidate: 'candidate:1 1 UDP 1 10.0.0.1 5000 typ host' } as RTCIceCandidate,
        ]);

        expect(frag).toBe([
            'a=ice-ufrag:abcd',
            'a=ice-pwd:efgh',
            'm=audio 9 UDP/TLS/RTP/SAVPF 111',
            'a=mid:1',
            'a=candidate:1 1 UDP 1 10.0.0.1 5000 typ host',
            '',
        ].join('\r\n'));
    });
});
