<template>
    <div
        ref='container'
        class='position-absolute bg-dark rounded border resizable-content text-white video-container'
    >
        <div
            style='height: 50px;'
            class='d-flex align-items-center px-2 py-2 border-bottom border-secondary'
        >
            <div
                ref='drag-handle'
                class='cursor-pointer'
            >
                <IconGripVertical
                    :size='24'
                    stroke='1'
                />
            </div>

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

            <div class='btn-list ms-auto'>
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

                <TablerIconButton
                    title='Close Video Player'
                    @click='emit("close")'
                >
                    <IconX
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div
            class='modal-body'
            :class='{ "modal-body--error": !!error }'
            :style='`height: calc(100% - 50px)`'
        >
            <div
                v-if='loading'
                class='col-12 d-flex align-items-center justify-content-center'
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
                    label='HLS Streaming Protocol'
                    :create='false'
                />
            </template>
            <template v-else>
                <video
                    ref='videoTag'
                    class='w-100 h-100 live-video'
                    controls
                    autoplay
                    muted
                />
            </template>
        </div>
    </div>
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
import type { VideoLeaseResponse, VideoLeaseMetadata } from '../../../types.ts';
import Hls from 'hls.js'
import { useFloatStore } from '../../../stores/float.ts';
import type { VideoPane } from '../../../stores/float.ts';
import {
    IconX,
    IconUsersGroup,
    IconGripVertical
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerButton,
    TablerIconButton,
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
const container = useTemplateRef<HTMLElement>('container');
const dragHandle = useTemplateRef<HTMLElement>('drag-handle');

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
const video = ref(floatStore.panes.get(props.uid) as VideoPane);
const videoLease = ref<VideoLeaseResponse | undefined>(); // CloudTAK video lease
const videoProtocols = ref<VideoLeaseMetadata["protocols"] | undefined>(); // Available streaming protocols

// Drag and resize functionality
const observer = ref<ResizeObserver | undefined>(); // Watches for container resize events
const lastPosition = ref({ top: 0, left: 0 }) // Last mouse position during drag

// Active stream metadata
const active = ref();

// Computed title - uses stream metadata name if available, falls back to prop
const title = computed(() => {
    if (active.value && active.value.metadata) {
        return active.value.metadata.name;
    } else {
        return props.title;
    }
});

// Cleanup when component is unmounted
onUnmounted(async () => {
    // Stop observing resize events
    if (observer.value) {
        observer.value.disconnect();
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
    // Set up resize observer to sync container size with store
    observer.value = new ResizeObserver((entries) => {
        if (!entries.length) return;

        // Use requestAnimationFrame for smooth resize updates
        window.requestAnimationFrame(() => {
            if (video.value && video.value && container.value) {
                video.value.config.height = entries[0].contentRect.height;
                video.value.config.width = entries[0].contentRect.width;
            }
        });
    })

    // Initialize container position and size from stored config
    if (container.value && video.value) {
        container.value.style.top = video.value.config.y + 'px';
        container.value.style.left = video.value.config.x + 'px';

        container.value.style.height = video.value.config.height + 'px';
        container.value.style.width = video.value.config.width + 'px';

        // Start observing container for resize events
        observer.value.observe(container.value);
    }

    // Set up drag functionality
    if (dragHandle.value) {
        dragHandle.value.addEventListener('mousedown', dragStart);
        dragHandle.value.addEventListener('touchstart', touchStart, { passive: false });
    }

    // Start the video lease request process
    await requestLease();
});

/**
 * Drag functionality - allows user to move the video player around the screen
 */
function dragStart(event: MouseEvent) {
    if (!container.value || !dragHandle.value) return;

    // Store initial mouse position
    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    // Add visual feedback for dragging state
    dragHandle.value.classList.add('dragging');

    // Attach drag event listeners
    container.value.addEventListener('mousemove', dragMove);
    container.value.addEventListener('mouseleave', dragEnd);
    container.value.addEventListener('mouseup', dragEnd);
}

function dragMove(event: MouseEvent) {
    if (!container.value || !dragHandle.value || !video.value) return;

    // Calculate new position based on mouse movement
    const dragElRect = container.value.getBoundingClientRect();

    // Update stored position in video config
    video.value.config.x = dragElRect.left + event.clientX - lastPosition.value.left;
    video.value.config.y = dragElRect.top + event.clientY - lastPosition.value.top;

    // Update last position for next move calculation
    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    // Apply new position to DOM element
    container.value.style.top = video.value.config.y + 'px';
    container.value.style.left = video.value.config.x + 'px';
}

function dragEnd() {
    if (!container.value || !dragHandle.value) return;

    // Remove drag event listeners
    container.value.removeEventListener('mousemove', dragMove);
    container.value.removeEventListener('mouseleave', dragEnd);
    container.value.removeEventListener('mouseup', dragEnd);

    // Remove visual feedback for dragging state
    dragHandle.value.classList.remove('dragging');
}

function touchStart(event: TouchEvent) {
    if (!container.value || !dragHandle.value) return;
    event.preventDefault();

    const touch = event.touches[0];
    lastPosition.value.left = touch.clientX;
    lastPosition.value.top = touch.clientY;

    dragHandle.value.classList.add('dragging');

    container.value.addEventListener('touchmove', touchMove, { passive: false });
    container.value.addEventListener('touchend', touchEnd);
    container.value.addEventListener('touchcancel', touchEnd);
}

function touchMove(event: TouchEvent) {
    if (!container.value || !dragHandle.value || !video.value) return;
    event.preventDefault();

    const touch = event.touches[0];
    const dragElRect = container.value.getBoundingClientRect();

    video.value.config.x = dragElRect.left + touch.clientX - lastPosition.value.left;
    video.value.config.y = dragElRect.top + touch.clientY - lastPosition.value.top;

    lastPosition.value.left = touch.clientX;
    lastPosition.value.top = touch.clientY;

    container.value.style.top = video.value.config.y + 'px';
    container.value.style.left = video.value.config.x + 'px';
}

function touchEnd() {
    if (!container.value || !dragHandle.value) return;

    container.value.removeEventListener('touchmove', touchMove);
    container.value.removeEventListener('touchend', touchEnd);
    container.value.removeEventListener('touchcancel', touchEnd);

    dragHandle.value.classList.remove('dragging');
}

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

        // Configure HLS.js with settings optimized for MediaMTX live streaming
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

        // Attach HLS player to video element
        player.value.attachMedia(videoTag.value!);

        // Load HLS source when media is attached
        player.value.on(Hls.Events.MEDIA_ATTACHED, async () => {
            if (player.value) player.value.loadSource(url.toString());
        });

        // Auto-play when manifest is loaded and parsed
        player.value.on(Hls.Events.MANIFEST_PARSED, async () => {
            try {
                if (videoTag.value) await videoTag.value.play();
            } catch (err) {
                console.error("Error playing video:", err);
            }
        });

        // Enhanced error handling for MediaMTX muxer restarts and network issues
        player.value.on(Hls.Events.ERROR, (event, data) => {
            console.log("HLS Error:", data);

            // Handle non-fatal errors gracefully (common with MediaMTX restarts)
            if (!data.fatal) {
                if (data.details === 'manifestLoadError' || data.details === 'levelLoadError' || data.details === 'bufferStalledError') {
                    handleStreamRestart(); // Handle muxer restart scenario
                }
                return;
            }

            switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log("Fatal network error:", data);
                    handleStreamError(data.error);
                    break;
                case Hls.ErrorTypes.MEDIA_ERROR:
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
                default:
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
    console.log('Handling HLS stream restart (muxer restart detected)');
    if (player.value && videoProtocols.value?.hls) {
        try {
            // Gracefully handle sequence mismatches by reloading from current position
            const currentTime = videoTag.value?.currentTime || 0;
            player.value.stopLoad();
            player.value.startLoad(currentTime);
        } catch (err) {
            console.error('Error handling stream restart:', err);
            // Fall back to full retry if restart handling fails
            handleStreamError(err instanceof Error ? err : new Error(String(err)));
        }
    }
}

/**
 * Handle stream errors with exponential backoff retry logic
 * Implements 3-attempt retry system with increasing delays: 1s, 2s, 4s
 */
function handleStreamError(streamError: Error): void {
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
        url.searchParams.append('url', video.value.config.url)
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
.dragging {
    cursor: move !important;
}

.resizable-content {
    min-height: 300px;
    min-width: 400px;
    resize: both;
    overflow: hidden;
}

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
</style>
