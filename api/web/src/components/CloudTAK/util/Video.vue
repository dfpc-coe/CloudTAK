<template>
    <div
        ref='container'
        class='position-absolute bg-dark rounded border resizable-content text-white'
        :style='`
            left: ${video ? video.x : 60}px;
            top: ${video ? video.y : 0}px;
        `'
    >
        <div class='d-flex align-items-center px-2 py-2'>
            <div
                ref='drag-handle'
                class='cursor-pointer'
            >
                <IconGripVertical
                    :size='24'
                    stroke='1'
                />
            </div>

            <div
                class='subheader'
                v-text='title'
            />

            <div class='btn-list ms-auto'>
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
                    :err='error'
                />

                <div class='d-flex justify-content-center'>
                    <TablerButton @click='$emit("close")'>
                        Close Player
                    </TablerButton>
                </div>
            </template>
            <template v-else-if='!videoProtocols || !videoProtocols.hls'>
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
import { ref, onMounted, onUnmounted, nextTick, useTemplateRef } from 'vue'
import { std } from '../../../../src/std.ts';
import type { VideoLeaseResponse } from '../../../types.ts';
import type Player from 'video.js/dist/types/player.d.ts';
import videojs from 'video.js';
import { useVideoStore } from '../../../../src/stores/videos.ts';
import 'video.js/dist/video-js.css';
import {
    IconX,
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
const lastPosition = ref({
    top: 0,
    left: 0
})

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
    await requestLease();

    observer.value = new ResizeObserver((entries) => {
        if (!entries.length) return;

        window.requestAnimationFrame(() => {        
            if (video.value && video.value && container.value) {
                video.value.height = entries[0].contentRect.height;
                video.value.width = entries[0].contentRect.width;
            }
        });
    })

    if (container.value) {
        container.value.style.height = video.value.height;
        container.value.style.width = video.value.width;

        observer.value.observe(container.value);
    }

    if (dragHandle.value) {
        dragHandle.value.addEventListener('mousedown', dragStart);
    }

    if (!error.value && videoProtocols.value && videoProtocols.value.hls) {
        nextTick(() => {
            player.value = videojs(id, {
                fluid: true,
            });
        });
    }
});

function dragStart(event: DragEvent) {
    if (!container.value || !dragHandle.value) return;

    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    console.error(event.clientX, event.clientY);

    dragHandle.value.classList.add('dragging');

    container.value.addEventListener('mousemove', dragMove);
    container.value.addEventListener('mouseleave', dragEnd);
    container.value.addEventListener('mouseup', dragEnd);
}

function dragMove(event: DragEvent) {
    if (!container.value || !dragHandle.value) return;


    const dragElRect = container.value.getBoundingClientRect();

    video.value.x = dragElRect.left + event.clientX - lastPosition.value.left;
    video.value.y = dragElRect.top + event.clientY - lastPosition.value.top;

    lastPosition.value.left = event.clientX;
    lastPosition.value.top = event.clientY;

    window.getSelection().removeAllRanges();
}

function dragEnd(event: DragEvent) {
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
    try {
        const { lease, protocols } = await std('/api/video/lease', {
            method: 'POST',
            body:  {
                name: 'Temporary Lease',
                ephemeral: true,
                duration: 1 * 60 * 60,
                proxy: video.value ? video.value.url : undefined
            }
        }) as VideoLeaseResponse

        videoLease.value = lease;
        videoProtocols.value = protocols;

        loading.value = false;
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
