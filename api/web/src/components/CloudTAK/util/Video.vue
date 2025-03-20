<template>
    <div
        ref='container'
        class='position-absolute bg-dark rounded border resizable-content text-white'
        :style='`
            left: ${video ? video.x : 60}px;
            top: ${video ? video.y : 0}px;
        `'
        :width='video.width'
        :height='video.height'
    >
        <div class='d-flex align-items-center px-2 py-2'>
            <div
                :draggable='true'
                @dragstart='dragStart'
            >
                <IconGripVertical
                    ref='drag-handle'
                    :size='24'
                    stroke='1'
                    class='cursor-pointer'
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
                    controls='true'
                    autoplay='true'
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

const emit = defineEmits(['close']);

const loading = ref(true);
const error = ref<Error | undefined>();
const player = ref<Player | undefined>()

const video = ref(videoStore.videos.get(props.uid));
const videoLease = ref<VideoLeaseResponse["lease"] | undefined>();
const videoProtocols = ref<VideoLeaseResponse["protocols"] | undefined>();
const observer = ref<ResizeObserver | undefined>();

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

    document.body.addEventListener('dragover', (event) => {
        if (video.value && video.value) {
            video.value.x = event.clientX;
            video.value.y = event.clientY;
        }

        event.preventDefault();
        return false;
    }, false);

    observer.value = new ResizeObserver(() => {
        if (video.value && video.value &&  container.value) {
            video.value.height = container.value.clientHeight;
            video.value.width = container.value.clientWidth;
        }
    })

    if (container.value) {
        observer.value.observe(container.value);
    }

    if (!error.value && videoProtocols.value && videoProtocols.value.hls) {
        nextTick(() => {
            player.value = videojs(id, {
                fluid: true
            });
        });
    }
});

function dragStart(event: DragEvent) {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.setDragImage(new Image(), 0, 0)
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
.resizable-content {
    min-height: 300px;
    min-width: 400px;
    resize: both;
    overflow: auto;
}
</style>
