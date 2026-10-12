<template>
    <TimesFooter :entries='entries' />
</template>

<script setup lang='ts'>
/** PropertyTimes - the audit footer of a CoT: when it was reported, when it is in effect and when it goes stale */
import { computed } from 'vue';
import TimesFooter, { type TimesFooterEntry } from '../util/TimesFooter.vue';
import type COT from '../../../base/cot';

const props = defineProps<{
    cot: COT
}>();

const entries = computed<Array<TimesFooterEntry>>(() => {
    const entries: Array<TimesFooterEntry> = [
        { label: 'Updated', time: props.cot.properties.time }
    ];

    if (props.cot.properties.start && props.cot.properties.start !== props.cot.properties.time) {
        entries.push({ label: 'Start', time: props.cot.properties.start });
    }

    entries.push({ label: 'Stale', time: props.cot.properties.stale });

    return entries;
});
</script>
