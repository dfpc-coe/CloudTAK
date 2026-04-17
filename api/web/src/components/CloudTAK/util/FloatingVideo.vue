<template>
    <FloatingPane
        :uid='uid'
        class='video-container'
        @close='emit("close")'
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
                        class='video-js vjs-default-skin vjs-live w-100 h-100 live-video'
                    />
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
 * Uses video.js with built-in HLS support for resilient playback.
 * Features error handling, automatic retry logic, and MediaMTX muxer restart recovery.
 */

import { ref, computed, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { std, stdurl } from '../../../../src/std.ts';
import StatusDot from './../../util/StatusDot.vue';
import VideoLeaseSourceType from './VideoLeaseSourceType.vue';
import FloatingPane from './FloatingPane.vue';
import type { VideoLeaseResponse, VideoLeaseMetadata } from '../../../types.ts';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import 'video.js/dist/video-js.css';
import { useFloatStore } from '../../../stores/float.ts';
import type { Pane, PaneVideoConfig } from '../../../stores/float.ts';
import {
    IconUsersGroup,
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

// Retry logic state
const retryCount = ref(0);
const maxRetries = ref(3); // Maximum retry attempts before giving up

// Video.js player instance
const player = ref<Player | undefined>()

// Video streaming data
const video = ref(floatStore.panes.get(props.uid) as Pane<PaneVideoConfig>);
const videoLease = ref<VideoLeaseResponse | undefined>(); // CloudTAK video lease
const videoProtocols = ref<VideoLeaseMetadata["protocols"] | undefined>(); // Available streaming protocols

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
    // Dispose video.js player instance
    if (player.value) {
        player.value.dispose();
        player.value = undefined;
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
 * Create and configure video.js player for HLS live streaming
 */
async function createPlayer(): Promise<void> {
    try {
        const url = new URL(videoProtocols.value!.hls!.url);

        const sourceUrl = url.toString();

        const vjsOptions: Parameters<typeof videojs>[1] = {
            autoplay: true,
            muted: true,
            controls: true,
            liveui: true,
            preload: 'auto',
            html5: {
                vhs: {
                    overrideNative: true,
                    enableLowInitialPlaylist: false,
                    smoothQualityChange: true,
                    handleManifestRedirects: true,
                },
            },
            sources: [{
                src: sourceUrl,
                type: 'application/x-mpegURL',
            }],
        };

        // Add authentication via beforeRequest if stream requires credentials
        if (url.username && url.password) {
            const authHeader = 'Basic ' + btoa(`${url.username}:${url.password}`);
            vjsOptions.html5 = {
                ...vjsOptions.html5,
                vhs: {
                    ...vjsOptions.html5?.vhs,
                    beforeRequest(options: Record<string, unknown>) {
                        if (!options.headers) options.headers = {};
                        (options.headers as Record<string, string>)['Authorization'] = authHeader;
                        return options;
                    },
                },
            };
        }

        player.value = videojs(videoTag.value!, vjsOptions);

        player.value.ready(() => {
            player.value!.play()?.catch((err: unknown) => {
                console.error('Error auto-playing video:', err);
            });
        });

        // Handle errors with retry logic
        player.value.on('error', () => {
            const mediaError = player.value?.error();
            console.log('Video.js Error:', mediaError);

            if (mediaError) {
                handleStreamError(new Error(mediaError.message || `Video error code ${mediaError.code}`));
            }
        });

        // Log when playback starts
        player.value.on('playing', () => {
            retryCount.value = 0; // Reset retry count on successful playback
        });
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
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
                player.value.dispose();
                player.value = undefined;
            }

            // Need to re-create the video element since dispose removes it
            nextTick(() => {
                createPlayer();
            });
        }, delay);
    } else {
        // Max retries reached - give up and show error to user
        console.error('Max retries reached, giving up');

        if (player.value) {
            player.value.dispose();
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

        // Initialize video.js player if we have protocols available
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
@import 'video.js/dist/video-js.css';

.video-container {
    container-type: inline-size;
}

.video-container .video-js {
    width: 100%;
    height: 100%;
}

.video-container .vjs-live .vjs-time-control,
.video-container .vjs-live .vjs-progress-control {
    display: none;
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
</style>
