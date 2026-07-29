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
                    class='cursor-pointer me-2 text-white small'
                    @click.stop='mode = mode === "relative" ? "absolute" : "relative"'
                    v-text='`Updated: ${format(props.updated)}`'
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
                    <span class='text-white'>Created</span>
                    <span class='text-white fw-semibold'>{{ format(props.created) }}</span>
                </div>
                <div class='d-flex justify-content-between align-items-center'>
                    <span class='text-white'>Updated</span>
                    <span class='text-white fw-semibold'>{{ format(props.updated) }}</span>
                </div>
                <div class='d-flex justify-content-between align-items-center'>
                    <span class='text-white'>Ended</span>
                    <span class='text-white fw-semibold'>{{ props.ended ? format(props.ended) : 'None' }}</span>
                </div>
            </div>
        </SlideDownHeader>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';
import SlideDownHeader from '../util/SlideDownHeader.vue';
import { IconClock } from '@tabler/icons-vue';
import timediff from '../../../timediff';

const props = defineProps<{
    created: string;
    updated: string;
    ended: string | null;
}>();

const expanded = ref(false);
const mode = ref('relative');

// Rerenders the relative times once a second
const currentTime = ref(new Date());
const interval = ref<ReturnType<typeof setInterval> | undefined>();

function format(time: string): string {
    void currentTime.value;
    return mode.value === 'relative' ? timediff(time) : time;
}

onMounted(() => {
    interval.value = setInterval(() => {
        currentTime.value = new Date();
    }, 1000);
});

onUnmounted(() => {
    if (interval.value) clearInterval(interval.value);
});
</script>
