<template>
    <TimesFooter :entries='entries' />
</template>

<script setup lang='ts'>
/** PropertyCoreEntityTimes - the audit footer: when & by whom the Event was created and when it last changed */
import { computed } from 'vue';
import TimesFooter, { type TimesFooterEntry } from '../util/TimesFooter.vue';

const props = defineProps<{
    created: string;
    updated: string;
    username?: string | null;
}>();

const entries = computed<Array<TimesFooterEntry>>(() => [
    { label: 'Created', time: props.created, suffix: props.username ? `by ${props.username}` : undefined },
    { label: 'Updated', time: props.updated },
]);
</script>
