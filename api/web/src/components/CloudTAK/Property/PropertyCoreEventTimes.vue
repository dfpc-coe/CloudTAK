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
                            <td>Created</td>
                            <td v-text='format(props.created)' />
                        </tr>
                        <tr>
                            <td>Updated</td>
                            <td v-text='format(props.updated)' />
                        </tr>
                        <tr>
                            <td>Ended</td>
                            <td v-text='props.ended ? format(props.ended) : "None"' />
                        </tr>
                    </tbody>
                </table>
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
