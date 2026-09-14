<template>
    <div class='h-100 w-100 video-player'>
        <div
            v-if='loading'
            class='col-12 d-flex align-items-center justify-content-center h-100'
        >
            <TablerLoading desc='Loading Stream' />
        </div>
        <template v-else-if='error'>
            <div class='video-player-error d-flex flex-column align-items-center justify-content-center text-center gap-3 h-100 w-100'>
                <div class='row g-2 w-100'>
                    <TablerAlert
                        class='video-player-error-alert w-100'
                        title='Video Error'
                        :compact='true'
                        :err='error'
                    />
                </div>

                <div class='row g-2 w-100 video-player-error-actions'>
                    <div class='col-12'>
                        <TablerButton
                            class='w-100'
                            @click='requestStream'
                        >
                            Retry
                        </TablerButton>
                    </div>
                </div>
            </div>
        </template>
        <template v-else-if='!protocolQueue.length'>
            <TablerNone
                label='No Supported Streaming Protocol'
                :create='false'
            />
        </template>
        <template v-else>
            <div class='position-relative w-100 h-100'>
                <div
                    ref='videoContainer'
                    class='w-100 h-100 live-video'
                />

                <div
                    v-if='isBuffering'
                    class='buffering-overlay'
                >
                    <div class='buffering-icon'>
                        <IconPlayerPauseFilled :size='64' />
                        <div class='mt-2 fw-bold'>
                            Buffering...
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
/**
 * VideoPlayer - Unified live-stream player used by the Floating Video Pane
 * and the Video Wall, with retry and MediaMTX muxer-restart recovery.
 *
 * video.js provides the player chrome while playback is driven by one of two
 * engines attached to its underlying <video> element:
 *   - WebRTC (WHEP) via media-infra - the default for RTSP/RTMP/SRT sources
 *   - HLS via hls.js - the default for proxied HLS sources & the WebRTC fallback
 *
 * Streams are supplied either as a raw stream `url` (resolved via /api/video/active,
 * creating a temporary ephemeral lease when required) or as an existing Video
 * Lease `lease` ID (renewed automatically when expired).
 */

import { ref, shallowRef, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue';
import { std, stdurl } from '../../std.ts';
import type { VideoLeaseResponse, VideoLeaseMetadata } from '../../types.ts';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import Hls from 'hls.js';
import WhepReader from './video/WhepReader.ts';
import {
    playbackOrder,
    splitCredentials,
    whepUrl,
    type PlaybackProtocol
} from './video/protocol.ts';
import {
    IconPlayerPauseFilled
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerButton,
} from '@tak-ps/vue-tabler';

export type VideoPlayerMetadata = {
    name: string;
    active: boolean;
    watchers: number;
    source_type?: string;
    source_model?: string;
};

const props = defineProps<{
    url?: string;
    lease?: number;
}>();

const emit = defineEmits<{
    metadata: [metadata: VideoPlayerMetadata];
    protocol: [protocol: PlaybackProtocol];
    error: [error: Error];
}>();

const videoContainer = useTemplateRef<HTMLDivElement>('videoContainer');

const loading = ref(true);
const error = ref<Error | undefined>();

const retryCount = ref(0);
const maxRetries = ref(3);
const lastStreamErrorAt = ref<number | undefined>();
const retryTimeout = ref<number | undefined>();

// Engine instances are never reactive - deep proxies break video.js & hls.js internals
const player = shallowRef<Player | undefined>();
const hls = shallowRef<Hls | undefined>();
const whep = shallowRef<WhepReader | undefined>();

const videoLease = ref<VideoLeaseResponse | undefined>();
const videoProtocols = ref<VideoLeaseMetadata["protocols"] | undefined>();

// Ordered protocols to attempt - the head is the active protocol, the rest are fallbacks
const protocolQueue = ref<PlaybackProtocol[]>([]);

const isBuffering = ref(false);
const pausedForBuffering = ref(false);
const bufferCheckInterval = ref<number | undefined>();
const bufferRecoveryTimeout = ref<number | undefined>();

// WebRTC frame watchdog state & whether WebRTC has ever delivered frames this session
const webrtcFrameCount = ref(0);
const webrtcStalledChecks = ref(0);
const webrtcPlayed = ref(false);

// Restarts attempted without playback recovering in between
const consecutiveRestarts = ref(0);

const BUFFER_LOW_THRESHOLD = 2;
const BUFFER_RECOVERY_THRESHOLD = 5;
const BUFFER_CHECK_INTERVAL_MS = 500;
const BUFFER_RECOVERY_TIMEOUT_MS = 10000;
const RETRY_RESET_STABLE_MS = 30000;
const WEBRTC_RETRY_PAUSE_MS = 2000;
const WEBRTC_CONNECT_TIMEOUT_MS = 8000;
const WEBRTC_STALL_CHECKS = 6;
const MAX_CONSECUTIVE_RESTARTS = 2;
const LEASE_RENEW_DURATION = 60 * 60 * 24;

function activeProtocol(): PlaybackProtocol | undefined {
    return protocolQueue.value[0];
}

function videoElement(): HTMLVideoElement | undefined {
    if (!player.value || player.value.isDisposed()) return;

    const el = player.value.tech(true)?.el();
    return el instanceof HTMLVideoElement ? el : undefined;
}

/**
 * Monitor video buffer levels and pause/resume playback as needed
 * Prevents reaching the end of buffer which causes refresh loops
 *
 * WebRTC MediaStreams expose no buffered ranges so they are monitored via
 * the decoded frame counter instead
 */
function monitorBuffer(): void {
    const video = videoElement();
    if (!video) return;

    try {
        if (video.srcObject) {
            monitorWebRTCFrames(video);
            return;
        }

        const buffered = video.buffered;
        if (buffered.length === 0) return;

        // A pause requested by the user is not a stall
        if (video.paused && !pausedForBuffering.value) return;

        const currentTime = video.currentTime;
        const bufferedEnd = buffered.end(buffered.length - 1);
        const bufferAhead = bufferedEnd - currentTime;

        if (bufferAhead < BUFFER_LOW_THRESHOLD && !isBuffering.value && !video.ended) {
            console.log(`Buffer running low (${bufferAhead.toFixed(2)}s), waiting for more data...`);
            setBuffering(true);
        }

        if (bufferAhead > BUFFER_RECOVERY_THRESHOLD && isBuffering.value) {
            console.log(`Buffer recovered (${bufferAhead.toFixed(2)}s), resuming playback...`);
            setBuffering(false);
        }
    } catch (err) {
        console.error('Error monitoring buffer:', err);
    }
}

/**
 * A WebRTC stream has stalled when decoded frames stop advancing while the
 * element is playing. Browsers without a frame counter never report a stall
 * here and rely on the track mute/unmute & element events instead
 */
function monitorWebRTCFrames(video: HTMLVideoElement): void {
    if (typeof video.getVideoPlaybackQuality !== 'function') return;

    const frames = video.getVideoPlaybackQuality().totalVideoFrames;

    if (frames > webrtcFrameCount.value) {
        webrtcFrameCount.value = frames;
        webrtcStalledChecks.value = 0;
        webrtcPlayed.value = true;

        if (isBuffering.value) setBuffering(false);
    } else if (webrtcFrameCount.value > 0 && !video.paused && !isBuffering.value) {
        webrtcStalledChecks.value++;

        if (webrtcStalledChecks.value >= WEBRTC_STALL_CHECKS) {
            console.log('WebRTC frames stopped arriving, waiting for the stream to resume...');
            setBuffering(true);
        }
    }
}

function clearBufferRecoveryTimeout(): void {
    if (bufferRecoveryTimeout.value) {
        clearTimeout(bufferRecoveryTimeout.value);
        bufferRecoveryTimeout.value = undefined;
    }
}

/**
 * Show/hide the buffering overlay. HLS keeps rendering whatever is already
 * buffered, so playback is paused while the overlay is up and resumed with it
 */
function setBuffering(buffering: boolean): void {
    isBuffering.value = buffering;

    const video = videoElement();

    if (!buffering) {
        clearBufferRecoveryTimeout();
        consecutiveRestarts.value = 0;

        if (pausedForBuffering.value) {
            pausedForBuffering.value = false;

            if (video && video.paused && !video.ended) {
                video.play().catch(e => console.error("Failed to resume video playback after buffering:", e));
            }
        }

        return;
    }

    // Only pause an element that would otherwise keep playing - one that is
    // already waiting on data has a pending play() that pause() would abort
    if (
        video
        && !video.srcObject
        && !video.paused
        && video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
        video.pause();
        pausedForBuffering.value = true;
    }

    clearBufferRecoveryTimeout();
    bufferRecoveryTimeout.value = window.setTimeout(() => {
        if (!isBuffering.value) return;

        console.warn('Buffering did not recover in time, attempting stream restart');
        handleStreamRestart();
    }, BUFFER_RECOVERY_TIMEOUT_MS);
}

function clearBufferCheckInterval(): void {
    if (bufferCheckInterval.value) {
        clearInterval(bufferCheckInterval.value);
        bufferCheckInterval.value = undefined;
    }

    webrtcFrameCount.value = 0;
    webrtcStalledChecks.value = 0;
}

function clearBufferMonitoring(): void {
    clearBufferCheckInterval();
    clearBufferRecoveryTimeout();

    isBuffering.value = false;
    pausedForBuffering.value = false;
    consecutiveRestarts.value = 0;
}

/**
 * Start polling the media element - any buffering state already shown
 * (initial connect, retry) is left up until playback is actually observed
 */
function startBufferMonitoring(): void {
    clearBufferCheckInterval();
    bufferCheckInterval.value = window.setInterval(monitorBuffer, BUFFER_CHECK_INTERVAL_MS);
}

/**
 * The retry budget is otherwise never replenished, so a wall tile left up
 * for hours is permanently retired by a handful of unrelated errors spread
 * across the session. Sustained playback clears it instead
 */
function resetRetriesIfStable(): void {
    if (!retryCount.value) return;
    if (lastStreamErrorAt.value && Date.now() - lastStreamErrorAt.value < RETRY_RESET_STABLE_MS) return;

    retryCount.value = 0;
}

function attachVideoEventHandlers(): void {
    const video = videoElement();
    if (!video) return;

    video.onwaiting = () => {
        if (!video.ended) setBuffering(true);
    };

    video.onstalled = () => {
        if (!video.ended) setBuffering(true);
    };

    video.onplaying = () => {
        if (video.srcObject) webrtcPlayed.value = true;
        setBuffering(false);
    };

    video.oncanplay = () => {
        if (isBuffering.value) setBuffering(false);
    };

    video.ontimeupdate = () => {
        resetRetriesIfStable();
    };

    video.onerror = () => {
        // Nothing to resume on an errored element - the engine handles recovery
        isBuffering.value = false;
        pausedForBuffering.value = false;
        clearBufferRecoveryTimeout();
    };
}

onUnmounted(async () => {
    teardownPlayer();

    await deleteLease();
});

onMounted(async () => {
    await requestStream();
});

/**
 * Clean up ephemeral video leases created by this player when it is destroyed
 * Leases passed in via the `lease` prop are never deleted
 */
async function deleteLease(): Promise<void> {
    if (!videoLease.value) return;

    try {
        await std(`/api/video/lease/${videoLease.value.id}`, {
            method: 'DELETE',
        });

        loading.value = false;
    } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
    }
}

function setError(err: Error): void {
    teardownPlayer();

    loading.value = false;
    error.value = err;
    emit('error', err);
}

function clearRetryTimeout(): void {
    if (retryTimeout.value) {
        clearTimeout(retryTimeout.value);
        retryTimeout.value = undefined;
    }
}

/**
 * Stop the active playback engine, leaving the video.js player in place
 */
function destroyEngine(): void {
    clearBufferMonitoring();
    clearRetryTimeout();

    if (hls.value) {
        hls.value.destroy();
        hls.value = undefined;
    }

    if (whep.value) {
        whep.value.close();
        whep.value = undefined;
    }

    const video = videoElement();
    if (video && video.srcObject) {
        video.srcObject = null;
    }
}

/**
 * Destroy the engine and the video.js player - Vue only ever manages the
 * container so video.js is free to restructure the DOM beneath it
 */
function teardownPlayer(): void {
    destroyEngine();

    if (player.value) {
        if (!player.value.isDisposed()) player.value.dispose();
        player.value = undefined;
    }
}

/**
 * Create the video.js player inside the container and start the active engine
 */
function createPlayer(): void {
    try {
        if (!player.value || player.value.isDisposed()) {
            const container = videoContainer.value;
            if (!container) throw new Error('Video container is not available');

            container.replaceChildren();

            const el = document.createElement('video');
            el.className = 'video-js vjs-fill';
            el.muted = true;
            el.playsInline = true;
            container.appendChild(el);

            player.value = videojs(el, {
                controls: true,
                autoplay: 'muted',
                muted: true,
                playsinline: true,
                fill: true,
                liveui: true,
                errorDisplay: false, // Errors & recovery are surfaced by this component
                controlBar: {
                    progressControl: false,
                    currentTimeDisplay: false,
                    durationDisplay: false,
                    remainingTimeDisplay: false,
                    timeDivider: false,
                    pictureInPictureToggle: false,
                },
            });

            attachVideoEventHandlers();
        }

        startEngine();
    } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
    }
}

function startEngine(): void {
    const protocol = activeProtocol();

    if (protocol === 'webrtc') {
        emit('protocol', protocol);
        createWebRTC();
    } else if (protocol === 'hls') {
        emit('protocol', protocol);
        createHls();
    } else {
        setError(new Error('No supported streaming protocol is available for this stream'));
    }
}

/**
 * Create a WHEP reader modelled on the MediaMTX web player and attach its
 * MediaStream to the video element
 */
function createWebRTC(): void {
    const video = videoElement();
    if (!video || !videoProtocols.value?.webrtc) return;

    if (!WhepReader.isSupported()) {
        handleProtocolExhausted(new Error('WebRTC is not supported in this browser'));
        return;
    }

    try {
        const { url, username, password } = splitCredentials(videoProtocols.value.webrtc.url);

        setBuffering(true);

        whep.value = new WhepReader({
            url: whepUrl(url),
            user: username,
            pass: password,
            retryPause: WEBRTC_RETRY_PAUSE_MS,
            connectTimeout: WEBRTC_CONNECT_TIMEOUT_MS,
            onTrack: (evt) => {
                const stream = evt.streams[0];
                if (!stream) return;

                // Remote tracks start muted & unmute once RTP arrives, which is
                // the earliest reliable signal that frames are flowing
                if (evt.track.kind === 'video') {
                    evt.track.onmute = () => {
                        if (video.srcObject === stream) setBuffering(true);
                    };
                    evt.track.onunmute = () => {
                        if (video.srcObject !== stream) return;
                        webrtcPlayed.value = true;
                        setBuffering(false);
                    };
                }

                // ontrack fires once per track - attach the shared stream only once
                if (video.srcObject === stream) return;

                video.srcObject = stream;
                video.play().catch(e => console.error("Error playing video:", e));

                startBufferMonitoring();
            },
            onConnected: () => {
                const stream = video.srcObject instanceof MediaStream ? video.srcObject : undefined;
                const track = stream?.getVideoTracks()[0];

                // Connected but still muted means no frames yet - keep the overlay up
                if (track && track.muted) return;

                setBuffering(false);
            },
            onError: (err) => {
                console.log("WebRTC Error:", err);

                lastStreamErrorAt.value = Date.now();

                if (!webrtcPlayed.value) {
                    // WebRTC never produced a frame this session - the environment
                    // likely cannot do WebRTC at all, so fall back immediately
                    handleProtocolExhausted(new Error(err));
                } else if (retryCount.value < maxRetries.value) {
                    // The reader tears down & restarts its own session, so only
                    // the retry budget is tracked here
                    retryCount.value++;
                    console.log(`WebRTC reconnecting (attempt ${retryCount.value}/${maxRetries.value})`);
                    setBuffering(true);
                } else {
                    console.error('Max WebRTC retries reached');
                    handleProtocolExhausted(new Error(err));
                }
            },
        });
    } catch (err) {
        handleStreamError(err instanceof Error ? err : new Error(String(err)));
    }
}

/**
 * Create and configure HLS.js with resilient settings for live streaming
 */
function createHls(): void {
    const video = videoElement();
    if (!video || !videoProtocols.value?.hls) return;

    if (!Hls.isSupported()) {
        handleProtocolExhausted(new Error('HLS.js is not supported in this browser.'));
        return;
    }

    try {
        // Send embedded basic-auth credentials via the Authorization header only,
        // keeping them out of the URL exposed to devtools, caches & hls.js telemetry
        const { url, username, password } = splitCredentials(videoProtocols.value.hls.url);

        const engine = new Hls({
            enableWorker: true,
            lowLatencyMode: false, // More forgiving for stream restarts
            debug: false,
            backBufferLength: 90, // Keep more buffer for smoother playback
            maxBufferLength: 30, // Larger buffer for resilience
            maxMaxBufferLength: 600,
            liveSyncDurationCount: 3, // More tolerant of discontinuities
            liveMaxLatencyDurationCount: 10,
            liveDurationInfinity: true, // Let video.js treat the stream as live
            xhrSetup: (xhr: XMLHttpRequest) => {
                if (username && password) {
                    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(`${username}:${password}`));
                }
            }
        });

        hls.value = engine;

        engine.attachMedia(video);

        engine.on(Hls.Events.MEDIA_ATTACHED, () => {
            engine.loadSource(url);
        });

        engine.on(Hls.Events.FRAG_BUFFERED, () => {
            resetRetriesIfStable();
        });

        engine.on(Hls.Events.MANIFEST_PARSED, async () => {
            try {
                await video.play();

                startBufferMonitoring();
            } catch (err) {
                console.error("Error playing video:", err);
            }
        });

        // Enhanced error handling for MediaMTX muxer restarts and network issues
        engine.on(Hls.Events.ERROR, (event, data) => {
            console.log("HLS Error:", data);

            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    if (!data.fatal) {
                        setBuffering(true);
                        engine.startLoad();
                        break;
                    } else {
                        console.log("Fatal network error:", data);
                        handleStreamError(data.error);
                        break;
                    }
                case Hls.ErrorTypes.MEDIA_ERROR:
                    if (!data.fatal) {
                        setBuffering(true);

                        try {
                            engine.recoverMediaError();
                        } catch (err) {
                            console.error('Failed to recover non-fatal media error:', err);
                        }

                        break;
                    } else {
                        console.log("Fatal media error:", data);

                        if (data.details === 'bufferAddCodecError' && data.error instanceof Error && data.error.name === 'NotSupportedError') {
                            setError(new Error(`Your browser does not support the required video codec for this stream${data.mimeType ? ` (${data.mimeType})` : ''}`));
                        } else {
                            try {
                                engine.recoverMediaError();
                            } catch {
                                handleStreamError(data.error);
                            }
                        }

                        break;
                    }
                default:
                    if (!data.fatal) return;

                    handleStreamError(data.error);
                    break;
            }
        });
    } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
    }
}

/**
 * Handle a stalled stream that never recovered
 *
 * HLS: MediaMTX muxer restarts create new segment naming after source hiccups,
 * so reload the playlist and seek to the live edge.
 * WebRTC: the peer connection is still up but no media is flowing, so
 * re-establish the WHEP session
 */
function handleStreamRestart(): void {
    if (activeProtocol() === 'webrtc') {
        console.log('Handling WebRTC stream restart (stalled stream detected)');
        handleStreamError(new Error('WebRTC stream stalled'));
        return;
    }

    const engine = hls.value;
    if (!engine || !videoProtocols.value?.hls) return;

    // A playlist reload that keeps stalling is not a muxer restart - escalate
    // to a full engine restart & eventually the fallback protocol
    if (consecutiveRestarts.value >= MAX_CONSECUTIVE_RESTARTS) {
        handleStreamError(new Error('HLS stream did not recover after restart'));
        return;
    }

    console.log('Handling HLS stream restart (muxer restart detected)');

    const restarts = consecutiveRestarts.value + 1;
    clearBufferMonitoring();
    consecutiveRestarts.value = restarts;

    try {
        engine.recoverMediaError();
        engine.stopLoad();
        engine.loadSource(engine.url!);

        const videoEl = engine.media;
        if (videoEl) {
            engine.once(Hls.Events.LEVEL_LOADED, () => {
                // Seek to the end (live edge) to bypass the stalled gap
                if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
                    videoEl.currentTime = videoEl.duration;
                }

                engine.startLoad();
                videoEl.play().catch(e => console.error("Play failed", e));
                startBufferMonitoring();
            });

            setBuffering(true);
        }
    } catch (err) {
        console.error('Error handling stream restart:', err);
        handleStreamError(err instanceof Error ? err : new Error(String(err)));
    }
}

/**
 * Handle stream errors with exponential backoff retry logic, restarting the
 * active engine - once the retry budget is exhausted fall back to the next protocol
 */
function handleStreamError(streamError: Error): void {
    destroyEngine();

    lastStreamErrorAt.value = Date.now();

    if (retryCount.value < maxRetries.value) {
        const delay = 1000 * Math.pow(2, retryCount.value); // 1s, 2s, 4s
        console.log(`Retrying ${activeProtocol()} stream in ${delay}ms (attempt ${retryCount.value + 1}/${maxRetries.value})`);

        retryCount.value++;

        setBuffering(true);

        retryTimeout.value = window.setTimeout(() => {
            retryTimeout.value = undefined;
            startEngine();
        }, delay);
    } else {
        console.error('Max retries reached, giving up');
        handleProtocolExhausted(streamError);
    }
}

/**
 * The active protocol could not be played - move on to the next protocol
 * in the queue or surface the error if none remain
 */
function handleProtocolExhausted(streamError: Error): void {
    destroyEngine();

    const failed = protocolQueue.value.shift();
    retryCount.value = 0;

    const next = activeProtocol();
    if (next) {
        console.warn(`${failed} playback failed (${streamError.message}), falling back to ${next}`);
        startEngine();
    } else {
        setError(streamError);
    }
}

/**
 * Resolve a raw stream URL via CloudTAK - either an existing active stream
 * or by creating a new temporary ephemeral lease
 */
async function requestUrlStream(url: string): Promise<void> {
    const active_url = stdurl('/api/video/active');
    active_url.searchParams.set('url', url);
    const active = await std(active_url) as {
        leasable: boolean;
        message?: string;
        metadata?: VideoPlayerMetadata & {
            protocols: VideoLeaseMetadata["protocols"];
            proxy?: string | null;
        };
    };

    if (active.metadata) {
        videoProtocols.value = active.metadata.protocols;
        // The lease source decides the default - the requested URL is only how it is served
        protocolQueue.value = playbackOrder(active.metadata.protocols, active.metadata.proxy, WhepReader.isSupported());
        emit('metadata', active.metadata);
        loading.value = false;
    } else if (active.leasable) {
        const lease = await std('/api/video/lease', {
            method: 'POST',
            body:  {
                name: 'Temporary Lease',
                ephemeral: true, // Hidden from streaming list
                duration: 1 * 60 * 60, // 1 hour lease
                proxy: url
            }
        }) as VideoLeaseResponse;

        const { protocols } = await std(`/api/video/lease/${lease.path}/metadata`) as VideoLeaseMetadata;

        videoLease.value = lease;
        videoProtocols.value = protocols;
        protocolQueue.value = playbackOrder(protocols, lease.proxy, WhepReader.isSupported());

        loading.value = false;
    } else {
        setError(new Error(active.message || 'Could not start stream'));
    }
}

/**
 * Resolve an existing Video Lease by ID - renewing the lease if it has expired
 */
async function requestLeaseStream(leaseId: number): Promise<void> {
    let lease = await std(`/api/video/lease/${leaseId}`) as VideoLeaseResponse;

    if (lease.expiration && new Date(lease.expiration).getTime() < Date.now()) {
        try {
            lease = await std(`/api/video/lease/${leaseId}`, {
                method: 'PATCH',
                body: {
                    duration: LEASE_RENEW_DURATION
                }
            }) as VideoLeaseResponse;
        } catch (err) {
            // Leases the user cannot manage (ie shared leases) cannot be renewed
            console.error('Could not renew video lease:', err);
        }
    }

    const metadata = await std(`/api/video/lease/${lease.path}/metadata`) as VideoLeaseMetadata;

    videoProtocols.value = metadata.protocols;
    protocolQueue.value = playbackOrder(metadata.protocols, lease.proxy, WhepReader.isSupported());

    emit('metadata', {
        name: lease.name,
        active: metadata.path ? metadata.path.ready : false,
        watchers: metadata.path ? metadata.path.readers.length : 0,
        source_type: lease.source_type,
        source_model: lease.source_model || ''
    });

    loading.value = false;
}

/**
 * Request the video stream from the CloudTAK server and initialize playback
 */
async function requestStream(): Promise<void> {
    loading.value = true;

    teardownPlayer();

    if (!WhepReader.isSupported() && !Hls.isSupported()) {
        setError(new Error('Neither WebRTC nor HLS.js is supported in this browser.'));
        return;
    }

    error.value = undefined;
    protocolQueue.value = [];
    webrtcPlayed.value = false;

    try {
        if (props.lease !== undefined) {
            await requestLeaseStream(props.lease);
        } else if (props.url) {
            await requestUrlStream(props.url);
        } else {
            setError(new Error('Video URL could not be loaded'));
            return;
        }

        if (!error.value && protocolQueue.value.length) {
            retryCount.value = 0;
            nextTick(() => {
                createPlayer();
            });
        }
    } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
    }
}
</script>

<style>
.video-player-error {
    padding: 1rem;
    max-width: 520px;
    margin-left: auto;
    margin-right: auto;
}

.video-player-error-alert,
.video-player-error-actions {
    max-width: 480px;
}

.live-video .video-js {
    width: 100%;
    height: 100%;
    background-color: #000;
}

.live-video .video-js .vjs-tech {
    object-fit: contain;
}

.buffering-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    pointer-events: none;
    backdrop-filter: blur(2px);
}

.buffering-icon {
    color: white;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.6;
    }
}
</style>
