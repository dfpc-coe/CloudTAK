<template>
    <div
        ref='container'
        class='position-absolute bg-dark rounded border resizable-content text-white'
    >
        <div
            style='height: 40px;'
            class='d-flex align-items-center px-2 py-2'
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

            <div class='mx-2'>
                <div
                    class='text-sm'
                    v-text='title'
                />
                <div
                    v-if='active && active.metadata && active.metadata.source_model'
                    class='subheader'
                    v-text='active.metadata.source_model'
                />
            </div>

            <div class='btn-list ms-auto'>
                <span v-if='active && active.metadata'>
                    <IconUsersGroup
                        :size='24'
                        stroke='1'
                    />
                    <span v-text='active.metadata.watchers + 1' />
                    <span
                        class='ms-1'
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
            :style='`height: calc(100% - 40px)`'
        >
            <div
                v-if='loading'
                class='col-12 d-flex align-items-center justify-content-center'
            >
                <TablerLoading label='Loading Stream' />
            </div>
            <template v-else-if='error'>
                <TablerAlert
                    title='Video Error'
                    :compact='true'
                    :err='error'
                />

                <div class='row g-2 col-12 ps-2 pt-4'>
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
                    class='w-100 h-100'
                    controls
                />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { std, stdurl } from '../../../../src/std.ts';
import StatusDot from './../../util/StatusDot.vue';
import VideoLeaseSourceType from './VideoLeaseSourceType.vue';
import type { VideoLeaseResponse } from '../../../types.ts';
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

const floatStore = useFloatStore();

const props = defineProps({
    title: {
        type: String,
        default: 'Video Stream'
    },
    uid: {
        type: String,
        required: true
    }
});

const videoTag = useTemplateRef<HTMLVideoElement>('videoTag');
const container = useTemplateRef<HTMLElement>('container');
const dragHandle = useTemplateRef<HTMLElement>('drag-handle');

const emit = defineEmits(['close']);

const loading = ref(true);
const error = ref<Error | undefined>();

const player = ref<Hls | undefined>()

const video = ref(floatStore.panes.get(props.uid) as VideoPane);
const videoLease = ref<VideoLeaseResponse["lease"] | undefined>();
const videoProtocols = ref<VideoLeaseResponse["protocols"] | undefined>();
const observer = ref<ResizeObserver | undefined>();
const lastPosition = ref({ top: 0, left: 0 })

const active = ref();

const title = computed(() => {
    if (active.value && active.value.metadata) {
        return active.value.metadata.name;
    } else {
        return props.title;
    }
});

onUnmounted(async () => {
    if (observer.value) {
        observer.value.disconnect();
    }

    if (player.value) {
        player.value.destroy();
    }

    await deleteLease();
});

onMounted(async () => {
    observer.value = new ResizeObserver((entries) => {
        if (!entries.length) return;

        window.requestAnimationFrame(() => {
            if (video.value && video.value && container.value) {
                video.value.config.height = entries[0].contentRect.height;
                video.value.config.width = entries[0].contentRect.width;
            }
        });
    })

    if (container.value && video.value) {
        container.value.style.top = video.value.config.y + 'px';
        container.value.style.left = video.value.config.x + 'px';

        container.value.style.height = video.value.config.height + 'px';
        container.value.style.width = video.value.config.width + 'px';

        observer.value.observe(container.value);
    }

    if (dragHandle.value) {
        dragHandle.value.addEventListener('mousedown', dragStart);
    }

    await requestLease();
});

function dragStart(event: MouseEvent) {
    if (!container.value || !dragHandle.value) return;

    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    dragHandle.value.classList.add('dragging');

    container.value.addEventListener('mousemove', dragMove);
    container.value.addEventListener('mouseleave', dragEnd);
    container.value.addEventListener('mouseup', dragEnd);
}

function dragMove(event: MouseEvent) {
    if (!container.value || !dragHandle.value || !video.value) return;


    const dragElRect = container.value.getBoundingClientRect();

    video.value.config.x = dragElRect.left + event.clientX - lastPosition.value.left;
    video.value.config.y = dragElRect.top + event.clientY - lastPosition.value.top;

    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    container.value.style.top = video.value.config.y + 'px';
    container.value.style.left = video.value.config.x + 'px';
}

function dragEnd() {
    if (!container.value || !dragHandle.value) return;

    container.value.removeEventListener('mousemove', dragMove);
    container.value.removeEventListener('mouseleave', dragEnd);
    container.value.removeEventListener('mouseup', dragEnd);

    dragHandle.value.classList.remove('dragging');
}

async function deleteLease(): Promise<void> {
    if (!videoLease.value) return;

    try {
        await std(`/api/video/lease/${videoLease.value.id}`, {
            method: 'DELETE',
        });

        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function createPlayer(): Promise<void> {
    try {
        const url = new URL(videoProtocols.value!.hls!.url);

        player.value = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            debug: true,
            maxBufferSize: 3000000,
            maxMaxBufferLength: 300,
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
                //if (videoTag.value) await videoTag.value.play();
            } catch (err) {
                console.error("Error playing video:", err);
                //error.value = new Error('Failed to play video');
            }
        });

        player.value.on(Hls.Events.ERROR, (event, data) => {
            console.log("Hls.Events.ERROR", data);

            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log("Fatal network error encountered", data);
                        if (player.value) player.value.destroy();
                        error.value = data.error;
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log("Fatal media error encountered", data);
                        if (player.value) {
                            player.value.recoverMediaError();
                        } else {
                            error.value = data.error;
                        }
                        break;
                    default:
                        if (player.value) player.value.destroy();
                        break;
                }

            }
        })
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

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
        const url = stdurl('/api/video/active');
        url.searchParams.append('url', video.value.config.url)
        active.value = await std(url);

        if (active.value.metadata) {
            videoProtocols.value = active.value.metadata.protocols;
            loading.value = false;
        } else if (active.value.leasable) {
            const { lease, protocols } = await std('/api/video/lease', {
                method: 'POST',
                body:  {
                    name: 'Temporary Lease',
                    ephemeral: true,
                    duration: 1 * 60 * 60,
                    proxy: video.value.config.url
                }
            }) as VideoLeaseResponse

            videoLease.value = lease;
            videoProtocols.value = protocols;

            loading.value = false;
        } else if (!active.value.leasable) {
            error.value = new Error(active.value.message || 'Could not start stream');
        }

        if (!error.value && videoProtocols.value && videoProtocols.value.hls) {
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
    overflow: auto;
}
</style>
