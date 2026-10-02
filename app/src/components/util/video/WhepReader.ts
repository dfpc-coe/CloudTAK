/**
 * WhepReader - WebRTC/WHEP reader for MediaMTX streams.
 *
 * A TypeScript port of the MediaMTX `reader.js` (MediaMTXWebRTCReader) shipped
 * with the MediaMTX web player, retaining its behaviour:
 *   - ICE servers are discovered via an OPTIONS request (Link headers)
 *   - The SDP offer is edited to enable stereo Opus & non-advertised codecs
 *   - ICE candidates are trickled via PATCH (application/trickle-ice-sdpfrag)
 *   - Failures tear the session down and restart after a short pause
 *
 * Credentials are sent via the Authorization header (never in the URL).
 */

export type WhepReaderConfig = {
    /** Absolute URL of the WHEP endpoint */
    url: string;
    user?: string;
    pass?: string;
    token?: string;
    /** Pause between restarts after an error (ms) */
    retryPause?: number;
    /** Abort a connection attempt that has not produced a track in this time (ms) */
    connectTimeout?: number;
    onError?: (err: string) => void;
    onTrack?: (evt: RTCTrackEvent) => void;
    onDataChannel?: (evt: RTCDataChannelEvent) => void;
    /** Called once the peer connection reaches the connected state */
    onConnected?: () => void;
};

type OfferData = {
    iceUfrag: string;
    icePwd: string;
    medias: string[];
};

type ReaderState = 'getting_codecs' | 'running' | 'restarting' | 'failed' | 'closed';

const NON_ADVERTISED_CODECS: Array<[string, string?]> = [
    ['pcma/8000/2'],
    ['multiopus/48000/6', 'channel_mapping=0,4,1,2,3,5;num_streams=4;coupled_streams=2'],
    ['L16/48000/2'],
];

export default class WhepReader {
    static DEFAULT_RETRY_PAUSE = 2000;
    static DEFAULT_CONNECT_TIMEOUT = 15000;

    // Codec support is a property of the browser - probe it once per page
    private static nonAdvertisedCodecsProbe: Promise<string[]> | null = null;

    static isSupported(): boolean {
        return typeof RTCPeerConnection !== 'undefined' && typeof fetch !== 'undefined';
    }

    private conf: WhepReaderConfig;
    private state: ReaderState = 'getting_codecs';
    private restartTimeout: number | null = null;
    private connectTimeout: number | null = null;
    private pc: RTCPeerConnection | null = null;
    private offerData: OfferData | null = null;
    private sessionUrl: string | null = null;
    private queuedCandidates: RTCIceCandidate[] = [];
    private nonAdvertisedCodecs: string[] = [];

    constructor(conf: WhepReaderConfig) {
        this.conf = conf;
        this.getNonAdvertisedCodecs();
    }

    close(): void {
        this.state = 'closed';

        this.clearConnectTimeout();

        if (this.pc !== null) {
            this.pc.close();
            this.pc = null;
        }

        if (this.sessionUrl !== null) {
            fetch(this.sessionUrl, { method: 'DELETE' }).catch(() => {});
            this.sessionUrl = null;
        }

        if (this.restartTimeout !== null) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }
    }

    private static supportsNonAdvertisedCodec(codec: string, fmtp?: string): Promise<boolean> {
        return new Promise((resolve) => {
            const pc = new RTCPeerConnection({ iceServers: [] });
            const mediaType = 'audio';
            let payloadType = '';

            pc.addTransceiver(mediaType, { direction: 'recvonly' });
            pc.createOffer()
                .then((offer) => {
                    if (offer.sdp === undefined) {
                        throw new Error('SDP not present');
                    }
                    if (offer.sdp.includes(` ${codec}`)) {
                        throw new Error('already present');
                    }

                    const sections = offer.sdp.split(`m=${mediaType}`);

                    const payloadTypes = sections
                        .slice(1)
                        .map((s) => s.split('\r\n')[0].split(' ').slice(3))
                        .reduce((prev, cur) => [...prev, ...cur], []);
                    payloadType = this.reservePayloadType(payloadTypes);

                    const lines = sections[1].split('\r\n');
                    lines[0] += ` ${payloadType}`;
                    lines.splice(lines.length - 1, 0, `a=rtpmap:${payloadType} ${codec}`);
                    if (fmtp !== undefined) {
                        lines.splice(lines.length - 1, 0, `a=fmtp:${payloadType} ${fmtp}`);
                    }
                    sections[1] = lines.join('\r\n');
                    offer.sdp = sections.join(`m=${mediaType}`);
                    return pc.setLocalDescription(offer);
                })
                .then(() =>
                    pc.setRemoteDescription(
                        new RTCSessionDescription({
                            type: 'answer',
                            sdp:
                                'v=0\r\n' +
                                'o=- 6539324223450680508 0 IN IP4 0.0.0.0\r\n' +
                                's=-\r\n' +
                                't=0 0\r\n' +
                                'a=fingerprint:sha-256 0D:9F:78:15:42:B5:4B:E6:E2:94:3E:5B:37:78:E1:4B:54:59:A3:36:3A:E5:05:EB:27:EE:8F:D2:2D:41:29:25\r\n' +
                                `m=${mediaType} 9 UDP/TLS/RTP/SAVPF ${payloadType}\r\n` +
                                'c=IN IP4 0.0.0.0\r\n' +
                                'a=ice-pwd:7c3bf4770007e7432ee4ea4d697db675\r\n' +
                                'a=ice-ufrag:29e036dc\r\n' +
                                'a=sendonly\r\n' +
                                'a=rtcp-mux\r\n' +
                                `a=rtpmap:${payloadType} ${codec}\r\n` +
                                (fmtp !== undefined ? `a=fmtp:${payloadType} ${fmtp}\r\n` : ''),
                        }),
                    ),
                )
                .then(() => resolve(true))
                .catch(() => resolve(false))
                .finally(() => pc.close());
        });
    }

    private static unquoteCredential(v: string): string {
        return JSON.parse(`"${v}"`);
    }

    static linkToIceServers(links: string | null): RTCIceServer[] {
        if (links === null) return [];

        const servers: RTCIceServer[] = [];

        for (const link of links.split(', ')) {
            const m = link.match(
                /^<(.+?)>; rel="ice-server"(; username="(.*?)"; credential="(.*?)"; credential-type="password")?/i,
            );

            if (!m) continue;

            const ret: RTCIceServer = {
                urls: [m[1]],
            };

            if (m[3] !== undefined) {
                ret.username = this.unquoteCredential(m[3]);
                ret.credential = this.unquoteCredential(m[4]);
            }

            servers.push(ret);
        }

        return servers;
    }

    static parseOffer(sdp: string): OfferData {
        const ret: OfferData = {
            iceUfrag: '',
            icePwd: '',
            medias: [],
        };

        for (const line of sdp.split('\r\n')) {
            if (line.startsWith('m=')) {
                ret.medias.push(line.slice('m='.length));
            } else if (ret.iceUfrag === '' && line.startsWith('a=ice-ufrag:')) {
                ret.iceUfrag = line.slice('a=ice-ufrag:'.length);
            } else if (ret.icePwd === '' && line.startsWith('a=ice-pwd:')) {
                ret.icePwd = line.slice('a=ice-pwd:'.length);
            }
        }

        return ret;
    }

    private static reservePayloadType(payloadTypes: string[]): string {
        // everything is valid between 30 and 127, except for interval between 64 and 95
        // https://chromium.googlesource.com/external/webrtc/+/refs/heads/master/call/payload_type.h#29
        for (let i = 30; i <= 127; i++) {
            if ((i <= 63 || i >= 96) && !payloadTypes.includes(i.toString())) {
                const pl = i.toString();
                payloadTypes.push(pl);
                return pl;
            }
        }
        throw Error('unable to find a free payload type');
    }

    private static addCodec(lines: string[], payloadTypes: string[], rtpmap: string, fmtp?: string): void {
        const payloadType = this.reservePayloadType(payloadTypes);
        lines[0] += ` ${payloadType}`;
        lines.splice(lines.length - 1, 0, `a=rtpmap:${payloadType} ${rtpmap}`);
        if (fmtp !== undefined) {
            lines.splice(lines.length - 1, 0, `a=fmtp:${payloadType} ${fmtp}`);
        }
        lines.splice(lines.length - 1, 0, `a=rtcp-fb:${payloadType} transport-cc`);
    }

    private static enableStereoPcmau(payloadTypes: string[], section: string): string {
        const lines = section.split('\r\n');
        this.addCodec(lines, payloadTypes, 'PCMU/8000/2');
        this.addCodec(lines, payloadTypes, 'PCMA/8000/2');
        return lines.join('\r\n');
    }

    private static enableMultichannelOpus(payloadTypes: string[], section: string): string {
        const lines = section.split('\r\n');
        this.addCodec(lines, payloadTypes, 'multiopus/48000/3', 'channel_mapping=0,2,1;num_streams=2;coupled_streams=1');
        this.addCodec(lines, payloadTypes, 'multiopus/48000/4', 'channel_mapping=0,1,2,3;num_streams=2;coupled_streams=2');
        this.addCodec(lines, payloadTypes, 'multiopus/48000/5', 'channel_mapping=0,4,1,2,3;num_streams=3;coupled_streams=2');
        this.addCodec(lines, payloadTypes, 'multiopus/48000/6', 'channel_mapping=0,4,1,2,3,5;num_streams=4;coupled_streams=2');
        this.addCodec(lines, payloadTypes, 'multiopus/48000/7', 'channel_mapping=0,4,1,2,3,5,6;num_streams=4;coupled_streams=4');
        this.addCodec(lines, payloadTypes, 'multiopus/48000/8', 'channel_mapping=0,6,1,4,5,2,3,7;num_streams=5;coupled_streams=4');
        return lines.join('\r\n');
    }

    private static enableL16(payloadTypes: string[], section: string): string {
        const lines = section.split('\r\n');
        this.addCodec(lines, payloadTypes, 'L16/8000/2');
        this.addCodec(lines, payloadTypes, 'L16/16000/2');
        this.addCodec(lines, payloadTypes, 'L16/48000/2');
        return lines.join('\r\n');
    }

    private static enableStereoOpus(section: string): string {
        let opusPayloadFormat = '';
        const lines = section.split('\r\n');

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('a=rtpmap:') && lines[i].toLowerCase().includes('opus/')) {
                opusPayloadFormat = lines[i].slice('a=rtpmap:'.length).split(' ')[0];
                break;
            }
        }

        if (opusPayloadFormat === '') {
            return section;
        }

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith(`a=fmtp:${opusPayloadFormat} `)) {
                if (!lines[i].includes('stereo')) {
                    lines[i] += ';stereo=1';
                }
                if (!lines[i].includes('sprop-stereo')) {
                    lines[i] += ';sprop-stereo=1';
                }
            }
        }

        return lines.join('\r\n');
    }

    static editOffer(sdp: string, nonAdvertisedCodecs: string[]): string {
        const sections = sdp.split('m=');

        const payloadTypes = sections
            .slice(1)
            .map((s) => s.split('\r\n')[0].split(' ').slice(3))
            .reduce((prev, cur) => [...prev, ...cur], []);

        for (let i = 1; i < sections.length; i++) {
            if (sections[i].startsWith('audio')) {
                sections[i] = this.enableStereoOpus(sections[i]);

                if (nonAdvertisedCodecs.includes('pcma/8000/2')) {
                    sections[i] = this.enableStereoPcmau(payloadTypes, sections[i]);
                }
                if (nonAdvertisedCodecs.includes('multiopus/48000/6')) {
                    sections[i] = this.enableMultichannelOpus(payloadTypes, sections[i]);
                }
                if (nonAdvertisedCodecs.includes('L16/48000/2')) {
                    sections[i] = this.enableL16(payloadTypes, sections[i]);
                }

                break;
            }
        }

        return sections.join('m=');
    }

    static generateSdpFragment(od: OfferData, candidates: RTCIceCandidate[]): string {
        const candidatesByMedia: Record<number, RTCIceCandidate[]> = {};
        for (const candidate of candidates) {
            const mid = candidate.sdpMLineIndex ?? 0;
            if (candidatesByMedia[mid] === undefined) {
                candidatesByMedia[mid] = [];
            }
            candidatesByMedia[mid].push(candidate);
        }

        let frag = `a=ice-ufrag:${od.iceUfrag}\r\n` + `a=ice-pwd:${od.icePwd}\r\n`;

        let mid = 0;

        for (const media of od.medias) {
            if (candidatesByMedia[mid] !== undefined) {
                frag += `m=${media}\r\n` + `a=mid:${mid}\r\n`;

                for (const candidate of candidatesByMedia[mid]) {
                    frag += `a=${candidate.candidate}\r\n`;
                }
            }
            mid++;
        }

        return frag;
    }

    private handleError(err: string): void {
        if (this.state === 'running') {
            this.clearConnectTimeout();

            if (this.pc !== null) {
                this.pc.close();
                this.pc = null;
            }

            this.offerData = null;

            if (this.sessionUrl !== null) {
                fetch(this.sessionUrl, { method: 'DELETE' }).catch(() => {});
                this.sessionUrl = null;
            }

            this.queuedCandidates = [];
            this.state = 'restarting';

            this.restartTimeout = window.setTimeout(
                () => this.restart(),
                this.conf.retryPause ?? WhepReader.DEFAULT_RETRY_PAUSE,
            );

            if (this.conf.onError !== undefined) {
                this.conf.onError(`${err}, retrying in some seconds`);
            }
        } else if (this.state === 'getting_codecs') {
            this.state = 'failed';

            if (this.conf.onError !== undefined) {
                this.conf.onError(err);
            }
        }
    }

    private restart(): void {
        this.restartTimeout = null;
        this.state = 'running';
        this.start();
    }

    private static probeNonAdvertisedCodecs(): Promise<string[]> {
        if (this.nonAdvertisedCodecsProbe === null) {
            this.nonAdvertisedCodecsProbe = Promise.all(
                NON_ADVERTISED_CODECS.map((c) =>
                    this.supportsNonAdvertisedCodec(c[0], c[1]).then((r) => (r ? c[0] : false)),
                ),
            ).then((c) => c.filter((e): e is string => e !== false));
        }

        return this.nonAdvertisedCodecsProbe;
    }

    private getNonAdvertisedCodecs(): void {
        WhepReader.probeNonAdvertisedCodecs()
            .then((codecs) => {
                if (this.state !== 'getting_codecs') {
                    throw new Error('closed');
                }

                this.nonAdvertisedCodecs = codecs;
                this.state = 'running';
                this.start();
            })
            .catch((err) => {
                this.handleError(String(err));
            });
    }

    private start(): void {
        this.armConnectTimeout();

        this.requestICEServers()
            .then((iceServers) => this.setupPeerConnection(iceServers))
            .then((offer) => this.sendOffer(offer))
            .then((answer) => this.setAnswer(answer))
            .catch((err) => {
                this.handleError(String(err));
            });
    }

    private armConnectTimeout(): void {
        this.clearConnectTimeout();

        const timeout = this.conf.connectTimeout ?? WhepReader.DEFAULT_CONNECT_TIMEOUT;
        if (!timeout) return;

        this.connectTimeout = window.setTimeout(() => {
            this.connectTimeout = null;
            if (this.state === 'running') {
                this.handleError('connection timeout');
            }
        }, timeout);
    }

    private clearConnectTimeout(): void {
        if (this.connectTimeout !== null) {
            clearTimeout(this.connectTimeout);
            this.connectTimeout = null;
        }
    }

    private authHeader(): Record<string, string> {
        if (this.conf.user !== undefined && this.conf.user !== '') {
            const credentials = btoa(`${this.conf.user}:${this.conf.pass ?? ''}`);
            return { Authorization: `Basic ${credentials}` };
        }
        if (this.conf.token !== undefined && this.conf.token !== '') {
            return { Authorization: `Bearer ${this.conf.token}` };
        }
        return {};
    }

    private requestICEServers(): Promise<RTCIceServer[]> {
        return fetch(this.conf.url, {
            method: 'OPTIONS',
            headers: this.authHeader(),
        }).then((res) => WhepReader.linkToIceServers(res.headers.get('Link')));
    }

    private setupPeerConnection(iceServers: RTCIceServer[]): Promise<string> {
        if (this.state !== 'running') {
            throw new Error('closed');
        }

        const pc = new RTCPeerConnection({ iceServers });
        this.pc = pc;

        const direction = 'recvonly';
        pc.addTransceiver('video', { direction });
        pc.addTransceiver('audio', { direction });

        // using data channels requires creating a data channel locally
        pc.createDataChannel('');

        pc.onicecandidate = (evt) => this.onLocalCandidate(evt);
        pc.onconnectionstatechange = () => this.onConnectionState();
        pc.ontrack = (evt) => this.onTrack(evt);
        pc.ondatachannel = (evt) => this.onDataChannel(evt);

        return pc.createOffer().then((offer) => {
            const sdp = WhepReader.editOffer(offer.sdp ?? '', this.nonAdvertisedCodecs);
            this.offerData = WhepReader.parseOffer(sdp);

            return pc.setLocalDescription({ type: 'offer', sdp }).then(() => sdp);
        });
    }

    private sendOffer(offer: string): Promise<string> {
        if (this.state !== 'running') {
            throw new Error('closed');
        }

        return fetch(this.conf.url, {
            method: 'POST',
            headers: {
                ...this.authHeader(),
                'Content-Type': 'application/sdp',
            },
            body: offer,
        }).then((res) => {
            switch (res.status) {
                case 201:
                    break;
                case 401:
                case 403:
                    throw new Error('unauthorized');
                case 404:
                    throw new Error('stream not found');
                case 400:
                    return res.json().then((e: { error?: string }) => {
                        throw new Error(e.error || 'bad request');
                    });
                default:
                    throw new Error(`bad status code ${res.status}`);
            }

            this.sessionUrl = new URL(res.headers.get('location') ?? '', this.conf.url).toString();

            return res.text();
        });
    }

    private setAnswer(answer: string): Promise<void> {
        if (this.state !== 'running' || this.pc === null) {
            throw new Error('closed');
        }

        return this.pc
            .setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer }))
            .then(() => {
                if (this.state !== 'running') {
                    return;
                }

                if (this.queuedCandidates.length !== 0) {
                    this.sendLocalCandidates(this.queuedCandidates);
                    this.queuedCandidates = [];
                }
            });
    }

    private onLocalCandidate(evt: RTCPeerConnectionIceEvent): void {
        if (this.state !== 'running') {
            return;
        }

        if (evt.candidate !== null) {
            if (this.sessionUrl === null) {
                this.queuedCandidates.push(evt.candidate);
            } else {
                this.sendLocalCandidates([evt.candidate]);
            }
        }
    }

    private sendLocalCandidates(candidates: RTCIceCandidate[]): void {
        if (this.sessionUrl === null || this.offerData === null) return;

        fetch(this.sessionUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/trickle-ice-sdpfrag',
                'If-Match': '*',
            },
            body: WhepReader.generateSdpFragment(this.offerData, candidates),
        })
            .then((res) => {
                switch (res.status) {
                    case 204:
                        break;
                    case 404:
                        throw new Error('stream not found');
                    default:
                        throw new Error(`bad status code ${res.status}`);
                }
            })
            .catch((err) => {
                this.handleError(String(err));
            });
    }

    private onConnectionState(): void {
        if (this.state !== 'running' || this.pc === null) {
            return;
        }

        if (this.pc.connectionState === 'connected') {
            this.clearConnectTimeout();

            if (this.conf.onConnected !== undefined) {
                this.conf.onConnected();
            }
        }

        // "closed" can arrive before "failed" and without
        // the close() method being called at all.
        // It happens when the other peer sends a termination
        // message like a DTLS CloseNotify.
        if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') {
            this.handleError('peer connection closed');
        }
    }

    private onTrack(evt: RTCTrackEvent): void {
        if (this.conf.onTrack !== undefined) {
            this.conf.onTrack(evt);
        }
    }

    private onDataChannel(evt: RTCDataChannelEvent): void {
        if (this.conf.onDataChannel !== undefined) {
            this.conf.onDataChannel(evt);
        }
    }
}
