<template>
    <div class='bg-dark rounded border resizable-content text-white'>
        <div class='d-flex align-items-center px-2 py-2'>
            <IconGripVertical :size='24' stroke='1'/>

            <div class='subheader' v-text='title'></div>

            <div class='ms-auto'>
                <TablerIconButton
                    title='Close Video Player'
                    @click='emit("close")'
                ><IconX :size='24' stroke='1'/></TablerIconButton>
            </div>
        </div>
        <div class='modal-body'>
            <TablerLoading v-if='loading' />
            <template v-else-if='err'>
                <TablerAlert
                    title='Video Error'
                    :err='err'
                />

                <div class='d-flex justify-content-center'>
                    <TablerButton @click='$emit("close")'>Close Player</TablerButton>
                </div>
            </template>
            <template v-else-if='!protocols || !protocols.hls'>
                <TablerNone
                    label='HLS Streaming Protocol'
                    :create='false'
                />
            </template>
            <template v-else>
                <video
                    id='cot-player'
                    class='video-js vjs-default-skin'
                    width='400'
                    height='300'
                    controls='true'
                    autoplay='true'
                >
                    <source
                        type='application/x-mpegURL'
                        :src='protocols.hls.url'
                    >
                </video>
            </template>
        </div>
    </div>
</template>

<style>
.resizable-content {
    min-height: 400px;
    min-width: 300px;
    resize: both;
    overflow: auto;
}
</style>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { std } from '../../../../src/std.ts';
import type { VideoLeaseResponse } from '../../../types.ts';
import type Player from 'video.js/dist/types/player.d.ts';
import videojs from 'video.js';
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

const props = defineProps({
    title: {
        type: String,
        default: 'Video Stream'
    },
    video: {
        type: String,
        required: true
    }
});

const emit = defineEmits(['close']);

const loading = ref(true);
const err = ref<Error | undefined>();
const lease = ref<VideoLeaseResponse["lease"] | undefined>();
const player = ref<Player | undefined>()
const protocols = ref<VideoLeaseResponse["protocols"] | undefined>();

onUnmounted(async () => {
    if (player.value) {
        player.value.dispose();
    }

    await deleteLease();
});

onMounted(async () => {
    await requestLease();

    if (!err.value && protocols.value && protocols.value.hls) {
        console.error('NEXT TICK')
        nextTick(() => {
            player.value = videojs('cot-player');
        });
    }
});

async function deleteLease(): Promise<void> {
    if (!lease.value) return;

    try {
        await std(`/api/video/lease/${lease.value.id}`, {
            method: 'DELETE',
        });

        loading.value = false;
    } catch (err) {
        loading.value = false;
        err.value = err instanceof Error ? err : new Error(String(err));
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
                proxy: props.video
            }
        }) as VideoLeaseResponse

        console.error(lease, protocols);
        lease.value = lease;
        protocols.value = protocols;

        loading.value = false;
    } catch (err) {
        loading.value = false;
        err.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
