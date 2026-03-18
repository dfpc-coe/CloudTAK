export type MediaMTXWebRTCReaderOptions = {
    url: string;
    onTrack: (event: RTCTrackEvent) => void;
    onError?: (error: Error) => void;
};

export default class MediaMTXWebRTCReader {
    readonly url: URL;
    readonly endpoint: URL;
    readonly peer: RTCPeerConnection;

    sessionUrl?: URL;
    abortController = new AbortController();
    closed = false;

    constructor(opts: MediaMTXWebRTCReaderOptions) {
        this.url = new URL(opts.url);
        this.endpoint = new URL(this.url.toString());
        this.endpoint.pathname = this.endpoint.pathname.replace(/\/$/, '') + '/whep';

        this.peer = new RTCPeerConnection();
        this.peer.addTransceiver('video', { direction: 'recvonly' });
        this.peer.addTransceiver('audio', { direction: 'recvonly' });
        this.peer.ontrack = opts.onTrack;
        this.peer.onconnectionstatechange = () => {
            if (this.closed) return;

            if (['failed', 'disconnected'].includes(this.peer.connectionState)) {
                opts.onError?.(new Error(`WebRTC connection ${this.peer.connectionState}`));
            }
        };
    }

    async start(): Promise<void> {
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        await this.waitForIceGatheringComplete();

        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: this.getHeaders({
                'Accept': 'application/sdp',
                'Content-Type': 'application/sdp'
            }),
            body: this.peer.localDescription?.sdp,
            signal: this.abortController.signal
        });

        if (!response.ok) {
            throw new Error(`WebRTC negotiation failed (${response.status}): ${await response.text()}`);
        }

        const location = response.headers.get('location');
        if (location) {
            this.sessionUrl = new URL(location, this.endpoint);
        }

        await this.peer.setRemoteDescription({
            type: 'answer',
            sdp: await response.text()
        });
    }

    async close(): Promise<void> {
        if (this.closed) return;
        this.closed = true;

        this.abortController.abort();

        try {
            if (this.sessionUrl) {
                await fetch(this.sessionUrl, {
                    method: 'DELETE',
                    headers: this.getHeaders(),
                });
            }
        } catch (err) {
            console.warn('Failed to close WebRTC session cleanly:', err);
        } finally {
            this.peer.close();
        }
    }

    private getHeaders(headers: Record<string, string> = {}): Headers {
        const requestHeaders = new Headers(headers);
        const token = this.url.searchParams.get('token');

        if (token) {
            requestHeaders.set('Authorization', `Bearer ${token}`);
        } else if (this.url.username || this.url.password) {
            requestHeaders.set('Authorization', `Basic ${btoa(`${decodeURIComponent(this.url.username)}:${decodeURIComponent(this.url.password)}`)}`);
        }

        return requestHeaders;
    }

    private waitForIceGatheringComplete(): Promise<void> {
        if (this.peer.iceGatheringState === 'complete') {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const handler = () => {
                if (this.peer.iceGatheringState === 'complete') {
                    this.peer.removeEventListener('icegatheringstatechange', handler);
                    resolve();
                }
            };

            this.peer.addEventListener('icegatheringstatechange', handler);
        });
    }
}
