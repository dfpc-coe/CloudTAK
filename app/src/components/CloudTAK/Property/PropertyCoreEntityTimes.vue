<template>
    <div
        class='d-flex align-items-center gap-1 px-3 py-2 border-top text-secondary small user-select-none cursor-pointer flex-shrink-0'
        title='Toggle relative & absolute time'
        @click='relative = !relative'
    >
        <span
            class='text-truncate'
            v-text='`Created ${format(created)}${username ? ` by ${username}` : ""}`'
        />
        <span>&middot;</span>
        <span
            class='flex-shrink-0'
            v-text='`Updated ${format(updated)}`'
        />
    </div>
</template>

<script setup lang='ts'>
/** PropertyCoreEntityTimes - the audit footer: when & by whom the Event was created and when it last changed */
import { ref, onMounted, onUnmounted } from 'vue';
import timediff from '../../../timediff';

defineProps<{
    created: string;
    updated: string;
    username?: string | null;
}>();

const relative = ref(true);

// Rerenders the relative times once a minute
const currentTime = ref(new Date());
let interval: ReturnType<typeof setInterval> | undefined;

function format(time: string): string {
    void currentTime.value;
    return relative.value ? timediff(time) : new Date(time).toLocaleString();
}

onMounted(() => {
    interval = setInterval(() => {
        currentTime.value = new Date();
    }, 60 * 1000);
});

onUnmounted(() => {
    if (interval) clearInterval(interval);
});
</script>
