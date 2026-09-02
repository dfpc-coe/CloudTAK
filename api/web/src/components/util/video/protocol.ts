import type { VideoLeaseProtocols } from '../../../types.ts';

export type PlaybackProtocol = 'webrtc' | 'hls';

/**
 * Leases proxying an existing HTTP(S) source are HLS streams being re-served
 * by MediaMTX - keep HLS as their default. Everything else (RTSP/RTMP/SRT/etc)
 * is served over WebRTC with HLS as the fallback.
 */
export function isHlsSource(source?: string | null): boolean {
    if (!source) return false;

    try {
        return ['http:', 'https:'].includes(new URL(source).protocol);
    } catch {
        return false;
    }
}

/**
 * Ordered list of protocols to attempt for playback - the first entry is the
 * default and each subsequent entry is a fallback
 */
export function playbackOrder(
    protocols: VideoLeaseProtocols | undefined,
    source?: string | null,
    webrtcSupported = true,
): PlaybackProtocol[] {
    if (!protocols) return [];

    const preferred: PlaybackProtocol[] = isHlsSource(source)
        ? ['hls', 'webrtc']
        : ['webrtc', 'hls'];

    return preferred.filter((protocol) => {
        if (!protocols[protocol]) return false;
        if (protocol === 'webrtc' && !webrtcSupported) return false;
        return true;
    });
}

/**
 * Split embedded basic-auth credentials out of a stream URL so they can be
 * sent via the Authorization header instead of being exposed in the URL
 */
export function splitCredentials(input: string): {
    url: string;
    username: string;
    password: string;
} {
    const url = new URL(input);

    let username = decodeURIComponent(url.username);
    let password = decodeURIComponent(url.password);
    url.username = '';
    url.password = '';

    // Unpopulated `{{username}}:{{password}}` templates carry no credentials
    if (/^\{\{.*\}\}$/.test(username)) {
        username = '';
        password = '';
    }

    return { url: url.toString(), username, password };
}

/**
 * MediaMTX serves WHEP at `<webrtc path url>/whep`
 */
export function whepUrl(webrtc: string): string {
    const url = new URL(webrtc);
    url.pathname = url.pathname.replace(/\/?$/, '/whep');
    return url.toString();
}
