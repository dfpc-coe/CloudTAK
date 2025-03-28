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
                :sourceType='active.metadata.source_type'
                :size='24'
            />

            <div class='mx-2'>
                <div
                    v-text='title'
                    class='text-sm'
                />
                <div
                    v-if='active && active.metadata && active.metadata.source_model'
                    class='subheader'
                    v-text='active.metadata.source_model'
                />
            </div>

            <div class='btn-list ms-auto'>
                <span v-if='active && active.metadata'>
                    <IconUsersGroup :size='24' stroke='1'/>
                    <span v-text='active.metadata.watchers + 1'/>
                    <span class='ms-1' v-text='active.metadata.watchers + 1 > 1 ? "Watchers" : "Watcher"'/>
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
                    :id='id'
                    class='video-js vjs-default-skin'
                    :controls='true'
                    :autoplay='true'
                >
                    <source
                        type='application/x-mpegURL'
                        :src='videoProtocols.hls.url'
                    >
                </video>
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
import type Player from 'video.js/dist/types/player.d.ts';
import videojs from 'video.js';
import { useVideoStore } from '../../../../src/stores/videos.ts';
import 'video.js/dist/video-js.css';
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

const videoStore = useVideoStore();
const id = `video-${(Math.random() + 1).toString(36).substring(7)}`;

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

const container = useTemplateRef<HTMLElement>('container');
const dragHandle = useTemplateRef<HTMLElement>('drag-handle');

const emit = defineEmits(['close']);

const loading = ref(true);
const error = ref<Error | undefined>();
const player = ref<Player | undefined>()

const video = ref(videoStore.videos.get(props.uid));
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
        player.value.dispose();
    }

    await deleteLease();
});

onMounted(async () => {
    observer.value = new ResizeObserver((entries) => {
        if (!entries.length) return;

        window.requestAnimationFrame(() => {
            if (video.value && video.value && container.value) {
                video.value.height = entries[0].contentRect.height;
                video.value.width = entries[0].contentRect.width;
            }
        });
    })

    if (container.value && video.value) {
        container.value.style.top = video.value.y + 'px';
        container.value.style.left = video.value.x + 'px';

        container.value.style.height = video.value.height + 'px';
        container.value.style.width = video.value.width + 'px';

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

    video.value.x = dragElRect.left + event.clientX - lastPosition.value.left;
    video.value.y = dragElRect.top + event.clientY - lastPosition.value.top;

    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    container.value.style.top = video.value.y + 'px';
    container.value.style.left = video.value.x + 'px';
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

async function requestLease(): Promise<void> {
    if (!video.value) throw new Error('Video URL could not be loaded');

    try {
        const url = stdurl('/api/video/active');
        url.searchParams.append('url', video.value.url)
        active.value = await std(url);

        if (active.value.metadata) {
            videoProtocols.value = active.value.metadata.protocols;
            loading.value = false;
        } else if (active.valueleaseable) {
            const { lease, protocols } = await std('/api/video/lease', {
                method: 'POST',
                body:  {
                    name: 'Temporary Lease',
                    ephemeral: true,
                    duration: 1 * 60 * 60,
                    proxy: video.value.url
                }
            }) as VideoLeaseResponse

            videoLease.value = lease;
            videoProtocols.value = protocols;

            loading.value = false;
        } else if (!active.leasable) {
            error.value = new Error(active.message || 'Could not start stream');
        }

        if (!error.value && videoProtocols.value && videoProtocols.value.hls) {
            nextTick(() => {
                player.value = videojs(id, {
                    fill: true,
                });
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
