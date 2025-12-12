<template>
    <div class='col-12 pt-2'>
        <div
            class='d-flex align-items-center cursor-pointer user-select-none py-2 px-2 rounded transition-all mx-2'
            :class='{ "bg-accent": expanded, "hover": !expanded }'
            @click='expanded = !expanded'
        >
            <IconClock
                :size='18'
                stroke='1'
                color='#6b7990'
                class='ms-2 me-1'
            />
            <label class='subheader cursor-pointer m-0'>Times</label>
            <div class='ms-auto d-flex align-items-center'>
                <IconChevronDown
                    class='transition-transform'
                    :class='{ "rotate-180": !expanded }'
                    :size='18'
                />
            </div>
        </div>

        <div
            class='grid-transition'
            :class='{ expanded: expanded }'
        >
            <div class='overflow-hidden'>
                <div class='d-flex mx-3 pt-2 pb-2'>
                    <div class='ms-auto cursor-pointer text-blue subheader'>
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
                <div class='list-group list-group-flush bg-accent rounded mx-2 mb-2'>
                    <div class='list-group-item bg-transparent d-flex justify-content-between align-items-center border-0'>
                        <span class='text-muted'>Time</span>
                        <span class='font-weight-medium'>{{ timeProp }}</span>
                    </div>
                    <div class='list-group-item bg-transparent d-flex justify-content-between align-items-center border-0'>
                        <span class='text-muted'>Start</span>
                        <span class='font-weight-medium'>{{ startProp }}</span>
                    </div>
                    <div class='list-group-item bg-transparent d-flex justify-content-between align-items-center border-0'>
                        <span class='text-muted'>Stale</span>
                        <span class='font-weight-medium'>{{ staleProp }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { IconClock, IconChevronDown } from '@tabler/icons-vue';
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

<style scoped>
.grid-transition {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 0.3s ease-out;
}

.grid-transition.expanded {
    grid-template-rows: 1fr;
}

.rotate-180 {
    transform: rotate(-90deg);
}

.transition-transform {
    transition: transform 0.3s ease-out;
}
</style>
