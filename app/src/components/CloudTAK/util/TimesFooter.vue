<template>
    <div
        class='d-flex align-items-center gap-1 px-3 py-2 border-top text-secondary small user-select-none cursor-pointer flex-shrink-0'
        title='Toggle relative & absolute time'
        @click='relative = !relative'
    >
        <template
            v-for='(entry, index) of entries'
            :key='entry.label'
        >
            <span v-if='index > 0'>&middot;</span>
            <span
                :class='index === 0 ? "text-truncate" : "flex-shrink-0"'
                :title='new Date(entry.time).toLocaleString()'
                v-text='text(entry)'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
/** TimesFooter - the audit footer of a sidebar: a row of labelled timestamps toggling between relative and absolute */
import { ref, onMounted, onUnmounted } from 'vue';
import timediff from '../../../timediff';

export type TimesFooterEntry = {
    label: string;
    time: string;
    /** Trailing text, ie the author of a "Created" entry */
    suffix?: string;
};

defineProps<{
    entries: Array<TimesFooterEntry>;
}>();

const relative = ref(true);

// Rerenders the relative times once a second so fresh CoTs count up
const currentTime = ref(new Date());
let interval: ReturnType<typeof setInterval> | undefined;

function text(entry: TimesFooterEntry): string {
    void currentTime.value;
    const time = relative.value ? timediff(entry.time) : new Date(entry.time).toLocaleString();
    return `${entry.label} ${time}${entry.suffix ? ` ${entry.suffix}` : ''}`;
}

onMounted(() => {
    interval = setInterval(() => {
        currentTime.value = new Date();
    }, 1000);
});

onUnmounted(() => {
    if (interval) clearInterval(interval);
});
</script>
