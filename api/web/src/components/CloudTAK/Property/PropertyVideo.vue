<template>
    <div class='col-12'>
        <SlideDownHeader
            v-model='expanded'
            label='Video'
        >
            <template #icon>
                <IconMovie
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>

            <div class='mx-2 py-2 mt-2'>
                <div class='rounded px-2 cloudtak-accent pb-2'>
                    <div class='row g-2'>
                        <div class='col-12'>
                            <TablerInput
                                v-model='video.url'
                                label='Video URL'
                                placeholder='rtsp://example.com:8554/stream'
                            />
                        </div>
                    </div>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { isEqual as deepEqual } from '@ver0/deep-equal';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import { IconMovie } from '@tabler/icons-vue';
import { TablerInput } from '@tak-ps/vue-tabler';
import type COT from '../../../base/cot';

interface Video {
    uid?: string;
    sensor?: string;
    spi?: string;
    url?: string;
    [key: string]: unknown;
}

interface Props {
    cot: COT;
}

const props = defineProps<Props>();

const expanded = ref(true);

function initVideo(raw?: Video): Video {
    const v = JSON.parse(JSON.stringify(raw || {})) as Video;
    if (v.url === undefined) v.url = '';
    return v;
}

const video = ref<Video>(initVideo(props.cot.properties.video as Video));

watch(video, (value) => {
    const next = initVideo(value);
    const current = initVideo(props.cot.properties.video as Video);

    if (deepEqual(next, current)) return;

    const properties = { ...props.cot.properties, video: next };
    props.cot.update({ properties });
}, { deep: true });

watch(() => props.cot.properties.video, (value) => {
    const next = initVideo(value);

    if (deepEqual(next, video.value)) return;

    video.value = next;
});
</script>
