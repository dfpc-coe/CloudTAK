<template>
    <div class='col-12'>
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
            <div class='table-responsive rounded mx-2 pb-2 px-2'>
                <table class='table table-transparent card-table table-hover table-vcenter'>
                    <thead>
                        <tr>
                            <th class='fw-bold'>
                                Key
                            </th>
                            <th class='fw-bold'>
                                Value
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Time</td>
                            <td v-text='timeProp' />
                        </tr>
                        <tr>
                            <td>Start</td>
                            <td v-text='startProp' />
                        </tr>
                        <tr>
                            <td>Stale</td>
                            <td v-text='staleProp' />
                        </tr>
                    </tbody>
                </table>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
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


