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
        <template v-else-if='!videoProtocols || !videoProtocols.hls'>
            <TablerNone
                label='No HLS Streaming Protocol'
                :create='false'
            />
        </template>
        <template v-else>
            <div class='position-relative w-100 h-100'>
                <video
                    ref='videoTag'
                    class='w-100 h-100 live-video'
                    controls
                    autoplay
                    muted
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
 * VideoPlayer - Unified HLS live-stream player used by the Floating Video Pane
 * and the Video Wall, with retry and MediaMTX muxer-restart recovery.
 *
 * Streams are supplied either as a raw stream `url` (resolved via /api/video/active,
 * creating a temporary ephemeral lease when required) or as an existing Video
 * Lease `lease` ID (renewed automatically when expired).
 */

import { ref, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { std, stdurl } from '../../std.ts';
import type { VideoLeaseResponse, VideoLeaseMetadata } from '../../types.ts';
import Hls from 'hls.js'
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
    error: [error: Error];
}>();

const videoTag = useTemplateRef<HTMLVideoElement>('videoTag');

const loading = ref(true);
const error = ref<Error | undefined>();

const retryCount = ref(0);
const maxRetries = ref(3);

const player = ref<Hls | undefined>();

const videoLease = ref<VideoLeaseResponse | undefined>();
const videoProtocols = ref<VideoLeaseMetadata["protocols"] | undefined>();

const isBuffering = ref(false);
const bufferCheckInterval = ref<number | undefined>();
const bufferRecoveryTimeout = ref<number | undefined>();

const BUFFER_LOW_THRESHOLD = 2;
const BUFFER_RECOVERY_THRESHOLD = 5;
const BUFFER_CHECK_INTERVAL_MS = 500;
const BUFFER_RECOVERY_TIMEOUT_MS = 10000;
const LEASE_RENEW_DURATION = 60 * 60 * 24;

/**
 * Monitor video buffer levels and pause/resume playback as needed
 * Prevents reaching the end of buffer which causes refresh loops
 */
function monitorBuffer(): void {
    const video = videoTag.value;
    if (!video) return;

    try {
        const buffered = video.buffered;
        if (buffered.length === 0) {
            if (isBuffering.value && !video.ended) return;
            return;
        }

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

            if (video.paused && !video.ended) {
                video.play().catch(e => console.error("Failed to resume video playback after buffering:", e));
            }
        }
    } catch (err) {
        console.error('Error monitoring buffer:', err);
    }
}

function clearBufferRecoveryTimeout(): void {
    if (bufferRecoveryTimeout.value) {
        clearTimeout(bufferRecoveryTimeout.value);
        bufferRecoveryTimeout.value = undefined;
    }
}

function setBuffering(buffering: boolean): void {
    isBuffering.value = buffering;

    if (!buffering) {
        clearBufferRecoveryTimeout();
        return;
    }

    clearBufferRecoveryTimeout();
    bufferRecoveryTimeout.value = window.setTimeout(() => {
        if (!isBuffering.value) return;

        console.warn('Buffering did not recover in time, attempting stream restart');
        handleStreamRestart();
    }, BUFFER_RECOVERY_TIMEOUT_MS);
}

function clearBufferMonitoring(): void {
    if (bufferCheckInterval.value) {
        clearInterval(bufferCheckInterval.value);
        bufferCheckInterval.value = undefined;
    }

    clearBufferRecoveryTimeout();
    isBuffering.value = false;
}

function startBufferMonitoring(): void {
    clearBufferMonitoring();
    bufferCheckInterval.value = window.setInterval(monitorBuffer, BUFFER_CHECK_INTERVAL_MS);
}

function attachVideoEventHandlers(): void {
    const video = videoTag.value;
    if (!video) return;

    video.onwaiting = () => {
        if (!video.ended) setBuffering(true);
    };

    video.onstalled = () => {
        if (!video.ended) setBuffering(true);
    };

    video.onplaying = () => {
        setBuffering(false);
    };

    video.oncanplay = () => {
        if (isBuffering.value) setBuffering(false);
    };

    video.onerror = () => {
        setBuffering(false);
    };
}

onUnmounted(async () => {
    clearBufferMonitoring();

    if (player.value) {
        player.value.destroy();
    }

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
        loading.value = false;
        setError(err instanceof Error ? err : new Error(String(err)));
    }
}

function setError(err: Error): void {
    error.value = err;
    emit('error', err);
}

/**
 * Create and configure HLS.js player with resilient settings for live streaming
 */
async function createPlayer(): Promise<void> {
    try {
        const url = new URL(videoProtocols.value!.hls!.url);

        attachVideoEventHandlers();

        player.value = new Hls({
            enableWorker: true,
            lowLatencyMode: false, // More forgiving for stream restarts
            debug: false,
            backBufferLength: 90, // Keep more buffer for smoother playback
            maxBufferLength: 30, // Larger buffer for resilience
            maxMaxBufferLength: 600,
            liveSyncDurationCount: 3, // More tolerant of discontinuities
            liveMaxLatencyDurationCount: 10,
            xhrSetup: (xhr: XMLHttpRequest) => {
                if (url.username && url.password) {
                    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(`${url.username}:${url.password}`));
                }
            }
        });

        player.value.attachMedia(videoTag.value!);

        player.value.on(Hls.Events.MEDIA_ATTACHED, async () => {
            if (player.value) player.value.loadSource(url.toString());
        });

        player.value.on(Hls.Events.MANIFEST_PARSED, async () => {
            try {
                if (videoTag.value) await videoTag.value.play();

                startBufferMonitoring();
            } catch (err) {
                console.error("Error playing video:", err);
            }
        });

        // Enhanced error handling for MediaMTX muxer restarts and network issues
        player.value.on(Hls.Events.ERROR, (event, data) => {
            console.log("HLS Error:", data);

            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    if (!data.fatal) {
                        setBuffering(true);

                        if (player.value) {
                            player.value.startLoad();
                        }

                        break;
                    } else {
                        console.log("Fatal network error:", data);
                        handleStreamError(data.error);
                        break;
                    }
                case Hls.ErrorTypes.MEDIA_ERROR:
                    if (!data.fatal) {
                        setBuffering(true);

                        if (player.value) {
                            try {
                                player.value.recoverMediaError();
                            } catch (err) {
                                console.error('Failed to recover non-fatal media error:', err);
                            }
                        }

                        break;
                    } else {
                        console.log("Fatal media error:", data);

                        if (data.details === 'bufferAddCodecError' && data.error instanceof Error && data.error.name === 'NotSupportedError') {
                            setError(new Error(`Your browser does not support the required video codec for this stream (${data.mimeType}`));
                        } else if (player.value) {
                            try {
                                player.value.recoverMediaError();
                            } catch {
                                handleStreamError(data.error);
                            }
                        } else {
                            handleStreamError(data.error);
                        }

                        break;
                    }
                default:
                    if (!data.fatal) return;

                    handleStreamError(data.error);
                    break;
            }
        })
    } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
    }
}

/**
 * Handle MediaMTX muxer restarts gracefully
 * This occurs when MediaMTX creates new segment naming due to source hiccups
 */
 function handleStreamRestart(): void {
    const hls = player.value;
    if (!hls || !videoProtocols.value?.hls) return;

    console.log('Handling HLS stream restart (muxer restart detected)');

    clearBufferMonitoring();

    try {
        hls.recoverMediaError();
        hls.stopLoad();
        hls.loadSource(hls.url!);

        const videoElement = hls.media;
        if (videoElement) {
            hls.once(Hls.Events.LEVEL_LOADED, () => {
                // Seek to the end (live edge) to bypass the stalled gap
                if (Number.isFinite(videoElement.duration) && videoElement.duration > 0) {
                    videoElement.currentTime = videoElement.duration;
                }

                hls.startLoad();
                videoElement.play().catch(e => console.error("Play failed", e));
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
 * Handle stream errors with exponential backoff retry logic
 */
function handleStreamError(streamError: Error): void {
    clearBufferMonitoring();

    if (retryCount.value < maxRetries.value) {
        const delay = 1000 * Math.pow(2, retryCount.value); // 1s, 2s, 4s
        console.log(`Retrying stream in ${delay}ms (attempt ${retryCount.value + 1}/${maxRetries.value})`);

        retryCount.value++;

        setTimeout(() => {
            if (player.value) {
                player.value.destroy();
                player.value = undefined;
            }

            createPlayer();
        }, delay);
    } else {
        console.error('Max retries reached, giving up');

        if (player.value) {
            player.value.destroy();
            player.value = undefined;
        }

        setError(streamError);
        retryCount.value = 0;
    }
}

/**
 * Resolve a raw stream URL via CloudTAK - either an existing active stream
 * or by creating a new temporary ephemeral lease
 */
async function requestUrlStream(url: string): Promise<void> {
    const active_url = stdurl('/api/video/active');
    active_url.searchParams.set('url', url)
    const active = await std(active_url) as {
        leasable: boolean;
        message?: string;
        metadata?: VideoPlayerMetadata & { protocols: VideoLeaseMetadata["protocols"] };
    };

    if (active.metadata) {
        videoProtocols.value = active.metadata.protocols;
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
        }) as VideoLeaseResponse

        const { protocols } = await std(`/api/video/lease/${lease.path}/metadata`) as VideoLeaseMetadata;

        videoLease.value = lease;
        videoProtocols.value = protocols;

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
    if (!Hls.isSupported()) {
        setError(new Error('HLS.js is not supported in this browser.'));
        return;
    } else {
        error.value = undefined;
    }

    try {
        if (props.lease !== undefined) {
            await requestLeaseStream(props.lease);
        } else if (props.url) {
            await requestUrlStream(props.url);
        } else {
            setError(new Error('Video URL could not be loaded'));
            return;
        }

        if (!error.value && videoProtocols.value && videoProtocols.value.hls) {
            retryCount.value = 0;
            nextTick(() => {
                createPlayer();
            });
        }
    } catch (err) {
        loading.value = false;
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

.live-video::-webkit-media-controls-timeline {
    display: none;
}

.live-video::-webkit-media-controls-current-time-display {
    display: none;
}

.live-video::-webkit-media-controls-time-remaining-display {
    display: none;
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
