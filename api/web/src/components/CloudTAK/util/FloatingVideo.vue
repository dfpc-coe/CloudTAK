<template>
    <FloatingPane
        :uid='uid'
        @close='emit("close")'
        class='video-container'
    >
        <template #header>
            <StatusDot
                v-if='active && active.metadata'
                :status='active.metadata.active ? "success" : "unknown"'
                :dark='true'
                :title='active.metadata.active ? "Streaming" : "Unknown"'
                :size='24'
            />

            <VideoLeaseSourceType
                v-if='active && active.metadata'
                :source-type='active.metadata.source_type'
                :size='24'
            />

            <div
                class='mx-2'
                style='max-width: calc(100% - 100px);'
            >
                <div
                    class='text-sm text-truncate'
                    v-text='title'
                />
                <div
                    v-if='active && active.metadata && active.metadata.source_model'
                    class='subheader'
                    v-text='active.metadata.source_model'
                />
            </div>
        </template>

        <template #actions>
            <span
                v-if='active && active.metadata'
                class='watchers-info'
            >
                <IconUsersGroup
                    :size='24'
                    stroke='1'
                />
                <span v-text='active.metadata.watchers + 1' />
                <span
                    class='ms-1 watcher-text'
                    v-text='active.metadata.watchers + 1 > 1 ? "Watchers" : "Watcher"'
                />
            </span>
        </template>

        <div
            class='h-100 w-100'
            :class='{ "modal-body--error": !!error }'
        >
            <div
                v-if='loading'
                class='col-12 d-flex align-items-center justify-content-center h-100'
            >
                <TablerLoading label='Loading Stream' />
            </div>
            <template v-else-if='error'>
                <div class='error-state d-flex flex-column align-items-center justify-content-center text-center gap-3 h-100 w-100'>
                    <div class='row g-2 w-100'>
                        <TablerAlert
                            class='error-alert w-100'
                            title='Video Error'
                            :compact='true'
                            :err='error'
                        />
                    </div>

                    <div class='row g-2 w-100 error-actions'>
                        <div class='col-md-6'>
                            <TablerButton
                                class='w-100'
                                @click='$emit("close")'
                            >
                                Close Player
                            </TablerButton>
                        </div>
                        <div class='col-md-6'>
                            <TablerButton
                                class='w-100'
                                @click='requestLease'
                            >
                                Retry
                            </TablerButton>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else-if='!video || !videoProtocols || !videoProtocols.hls'>
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
                    
                    <!-- Buffering Overlay -->
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
    </FloatingPane>
</template>

<script setup lang='ts'>
/**
 * FloatingVideo Component
 *
 * A draggable, resizable video player component for HLS live streaming.
 * Features resilient error handling, automatic retry logic, and MediaMTX muxer restart recovery.
 */

import { ref, computed, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { std, stdurl } from '../../../../src/std.ts';
import StatusDot from './../../util/StatusDot.vue';
import VideoLeaseSourceType from './VideoLeaseSourceType.vue';
import FloatingPane from './FloatingPane.vue';
import type { VideoLeaseResponse, VideoLeaseMetadata } from '../../../types.ts';
import Hls from 'hls.js'
import { useFloatStore } from '../../../stores/float.ts';
import type { Pane, PaneVideoConfig } from '../../../stores/float.ts';
import {
    IconUsersGroup,
    IconPlayerPauseFilled
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerButton,
} from '@tak-ps/vue-tabler';

// Store for managing floating panes
const floatStore = useFloatStore();

// Component props
const props = defineProps({
    title: {
        type: String,
        default: 'Video Stream'
    },
    uid: {
        type: String,
        required: true // Unique identifier for this video pane
    }
});

// Template refs for DOM elements
const videoTag = useTemplateRef<HTMLVideoElement>('videoTag');

// Component events
const emit = defineEmits(['close']);

// UI state management
const loading = ref(true);
const error = ref<Error | undefined>();

// HLS retry logic state
const retryCount = ref(0);
const maxRetries = ref(3); // Maximum retry attempts before giving up

// HLS player instance
const player = ref<Hls | undefined>()

// Video streaming data
const video = ref(floatStore.panes.get(props.uid) as Pane<PaneVideoConfig>);
const videoLease = ref<VideoLeaseResponse | undefined>(); // CloudTAK video lease
const videoProtocols = ref<VideoLeaseMetadata["protocols"] | undefined>(); // Available streaming protocols

// Active stream metadata
const active = ref();

// Buffer monitoring state
const isBuffering = ref(false);
const bufferCheckInterval = ref<number | undefined>();

// Buffer monitoring configuration
const BUFFER_LOW_THRESHOLD = 2; // Pause when buffer falls below 2 seconds
const BUFFER_RECOVERY_THRESHOLD = 5; // Resume when buffer recovers to 5+ seconds
const BUFFER_CHECK_INTERVAL_MS = 500; // Check buffer every 500ms

// Computed title - uses stream metadata name if available, falls back to prop
const title = computed(() => {
    if (active.value && active.value.metadata) {
        return active.value.metadata.name;
    } else {
        return props.title;
    }
});

/**
 * Monitor video buffer levels and pause/resume playback as needed
 * Prevents reaching the end of buffer which causes refresh loops
 */
function monitorBuffer(): void {
    const video = videoTag.value;
    if (!video || video.paused) return;

    try {
        const buffered = video.buffered;
        if (buffered.length === 0) return;

        const currentTime = video.currentTime;
        const bufferedEnd = buffered.end(buffered.length - 1);
        const bufferAhead = bufferedEnd - currentTime;

        // If buffer is low (less than threshold), pause and show overlay
        if (bufferAhead < BUFFER_LOW_THRESHOLD && !isBuffering.value) {
            console.log(`Buffer running low (${bufferAhead.toFixed(2)}s), pausing for buffering...`);
            video.pause();
            isBuffering.value = true;
        }

        // If buffer has recovered (more than threshold), resume
        if (bufferAhead > BUFFER_RECOVERY_THRESHOLD && isBuffering.value) {
            console.log(`Buffer recovered (${bufferAhead.toFixed(2)}s), resuming playback...`);
            isBuffering.value = false;
            video.play().catch(e => console.error("Failed to resume video playback after buffering:", e));
        }
    } catch (err) {
        console.error('Error monitoring buffer:', err);
    }
}

// Cleanup when component is unmounted
onUnmounted(async () => {
    // Stop buffer monitoring
    if (bufferCheckInterval.value) {
        clearInterval(bufferCheckInterval.value);
        bufferCheckInterval.value = undefined;
    }

    // Destroy HLS player instance
    if (player.value) {
        player.value.destroy();
    }

    // Clean up video lease from server
    await deleteLease();
});

// Initialize component when mounted
onMounted(async () => {
    // Start the video lease request process
    await requestLease();
});

/**
 * Clean up video lease from CloudTAK server when component is destroyed
 */
async function deleteLease(): Promise<void> {
    if (!videoLease.value) return;

    try {
        // Delete the temporary video lease from server
        await std(`/api/video/lease/${videoLease.value.id}`, {
            method: 'DELETE',
        });

        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

/**
 * Create and configure HLS.js player with resilient settings for live streaming
 */
async function createPlayer(): Promise<void> {
    try {
        const url = new URL(videoProtocols.value!.hls!.url);

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
                // Add authentication if stream requires it
                if (url.username && url.password) {
                    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(`${url.username}:${url.password}`));
                }
            }
        });

        player.value.attachMedia(videoTag.value!);

        player.value.on(Hls.Events.MEDIA_ATTACHED, async () => {
            if (player.value) player.value.loadSource(url.toString());
        });

        // Auto-play when manifest is loaded and parsed
        player.value.on(Hls.Events.MANIFEST_PARSED, async () => {
            try {
                if (videoTag.value) await videoTag.value.play();
                
                // Start buffer monitoring interval
                bufferCheckInterval.value = window.setInterval(monitorBuffer, BUFFER_CHECK_INTERVAL_MS);
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
                        handleStreamRestart(); // Handle muxer restart scenario
                        break;
                    } else {
                        console.log("Fatal network error:", data);
                        handleStreamError(data.error);
                        break;
                    }
                case Hls.ErrorTypes.MEDIA_ERROR:
                    if (!data.fatal) {
                        handleStreamRestart(); // Handle muxer restart scenario
                        break;
                    } else {
                        console.log("Fatal media error:", data);

                        if (data.details === 'bufferAddCodecError' && data.error instanceof Error && data.error.name === 'NotSupportedError') {
                            error.value = new Error(`Your browser does not support the required video codec for this stream (${data.mimeType}`);
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

                    // Handle other fatal errors with retry logic
                    handleStreamError(data.error);
                    break;
            }
        })
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
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

    // Clear buffer monitoring before restarting player
    if (bufferCheckInterval.value) {
        clearInterval(bufferCheckInterval.value);
        bufferCheckInterval.value = undefined;
    }

    try {
        hls.recoverMediaError();
        hls.stopLoad();
        hls.loadSource(hls.url!); 

        const videoElement = hls.media;
        if (videoElement) {
            hls.once(Hls.Events.LEVEL_LOADED, () => {
                // Seek to the end (live edge) to bypass the stalled gap
                videoElement.currentTime = videoElement.duration;
                hls.startLoad();
                videoElement.play().catch(e => console.error("Play failed", e));
            });
        }
    } catch (err) {
        console.error('Error handling stream restart:', err);
        handleStreamError(err instanceof Error ? err : new Error(String(err)));
    }
}

/**
 * Handle stream errors with exponential backoff retry logic
 * Implements 3-attempt retry system with increasing delays: 1s, 2s, 4s
 */
function handleStreamError(streamError: Error): void {
    // Clear buffer monitoring before destroying player
    if (bufferCheckInterval.value) {
        clearInterval(bufferCheckInterval.value);
        bufferCheckInterval.value = undefined;
    }

    if (retryCount.value < maxRetries.value) {
        // Calculate exponential backoff delay
        const delay = 1000 * Math.pow(2, retryCount.value); // 1s, 2s, 4s
        console.log(`Retrying stream in ${delay}ms (attempt ${retryCount.value + 1}/${maxRetries.value})`);

        retryCount.value++;

        // Retry after delay
        setTimeout(() => {
            if (player.value) {
                player.value.destroy();
                player.value = undefined;
            }

            createPlayer();
        }, delay);
    } else {
        // Max retries reached - give up and show error to user
        console.error('Max retries reached, giving up');

        if (player.value) {
            player.value.destroy();
            player.value = undefined;
        }

        error.value = streamError;
        retryCount.value = 0;
    }
}

/**
 * Request video lease from CloudTAK server and initialize streaming
 * Handles both existing active streams and creation of new temporary leases
 */
async function requestLease(): Promise<void> {
    if (!video.value) {
        error.value = new Error('Video URL could not be loaded');
        return;
    } else if (!Hls.isSupported()) {
        error.value = new Error('HLS.js is not supported in this browser.');
        return;
    } else {
        error.value = undefined;
    }

    try {
        // Check if stream is already active on the server
        const url = stdurl('/api/video/active');
        url.searchParams.set('url', video.value.config.url)
        active.value = await std(url);

        if (active.value.metadata) {
            // Stream is already active - use existing protocols
            videoProtocols.value = active.value.metadata.protocols;
            loading.value = false;
        } else if (active.value.leasable) {
            // Stream can be leased - create temporary lease
            const lease = await std('/api/video/lease', {
                method: 'POST',
                body:  {
                    name: 'Temporary Lease',
                    ephemeral: true, // Hidden from streaming list
                    duration: 1 * 60 * 60, // 1 hour lease
                    proxy: video.value.config.url // Proxy the external stream
                }
            }) as VideoLeaseResponse

            const { protocols } = await std(`/api/video/lease/${lease.path}/metadata`) as VideoLeaseMetadata;

            videoLease.value = lease;
            videoProtocols.value = protocols;

            loading.value = false;
        } else if (!active.value.leasable) {
            // Stream cannot be leased
            error.value = new Error(active.value.message || 'Could not start stream');
        }

        // Initialize HLS player if we have protocols available
        if (!error.value && videoProtocols.value && videoProtocols.value.hls) {
            retryCount.value = 0; // Reset retry count for new lease
            nextTick(() => {
                createPlayer();
            });
        }
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

<style>
.video-container {
    container-type: inline-size;
}

.modal-body--error {
    display: flex;
    align-items: center;
    justify-content: center;
}

.error-state {
    padding: 1rem;
    max-width: 520px;
}

.error-alert,
.error-actions {
    max-width: 480px;
}

@container (max-width: 500px) {
    .watchers-info .watcher-text {
        display: none;
    }
}

@container (max-width: 450px) {
    .watchers-info {
        display: none !important;
    }
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
