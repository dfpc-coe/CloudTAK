<template>
    <div class='col-12 pt-2'>
        <SlideDownHeader
            v-model='expanded'
            label='Times'
        >
            <template #icon>
                <IconClock
                    :size='18'
                    stroke='1'
                    color='#6b7990'
                    class='ms-2 me-1'
                />
            </template>
            <template #right>
                <span
                    v-if='props.cot.properties.start'
                    class='cursor-pointer me-2 text-white small'
                    @click.stop='mode = mode === "relative" ? "absolute" : "relative"'
                    v-text='`Start: ${startProp}`'
                />
            </template>
            <div class='d-flex mx-3 pt-2 pb-2'>
                <div class='ms-auto cursor-pointer subheader text-white'>
                    <span
                        v-if='mode === "relative"'
                        @click='mode = "absolute"'
                    >Absolute</span>
                    <span
                        v-if='mode === "absolute"'
                        @click='mode = "relative"'
                    >Relative</span>
                </div>
            </div>
            <div class='rounded cloudtak-accent mx-2 mb-2 px-2 py-2 d-flex flex-column gap-2'>
                <div class='d-flex justify-content-between align-items-center'>
                    <span class='text-white'>Time</span>
                    <span class='text-white fw-semibold'>{{ timeProp }}</span>
                </div>
                <div class='d-flex justify-content-between align-items-center'>
                    <span class='text-white'>Start</span>
                    <span class='text-white fw-semibold'>{{ startProp }}</span>
                </div>
                <div class='d-flex justify-content-between align-items-center'>
                    <span class='text-white'>Stale</span>
                    <span class='text-white fw-semibold'>{{ staleProp }}</span>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import SlideDownHeader from './SlideDownHeader.vue';
import { IconClock } from '@tabler/icons-vue';
import timediff from '../../../timediff';
import type COT from '../../../base/cot';

const props = defineProps<{
    cot: COT
}>();

const expanded = ref(false);
const mode = ref('relative');
const currentTime = ref(new Date());
const interval = ref<ReturnType<typeof setInterval> | undefined>();

const staleProp = computed(() => {
    if (!props.cot) return '';
    return (currentTime.value && mode.value === 'relative') ? timediff(props.cot.properties.stale) : props.cot.properties.stale;
});

const startProp = computed(() => {
    if (!props.cot) return '';
    return (currentTime.value && mode.value === 'relative') ? timediff(props.cot.properties.start) : props.cot.properties.start;
});

const timeProp = computed(() => {
    if (!props.cot) return '';
    return (currentTime.value && mode.value === 'relative') ? timediff(props.cot.properties.time) : props.cot.properties.time;
});

onMounted(() => {
    interval.value = setInterval(() => {
        currentTime.value = new Date();
    }, 1000);
});

onUnmounted(() => {
    if (interval.value) clearInterval(interval.value);
});
</script>


