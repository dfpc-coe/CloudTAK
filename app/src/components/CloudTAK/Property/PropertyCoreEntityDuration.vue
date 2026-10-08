<template>
    <PropertyFactRow
        label='Started'
        class='py-1'
    >
        <CopyField
            :model-value='toLocalInput(started)'
            :display='timediff(started)'
            :title='new Date(started).toLocaleString()'
            type='datetime-local'
            :edit='edit'
            :validate='validateStarted'
            :size='24'
            @submit='emit("update:started", new Date(String($event)).toISOString())'
        />
    </PropertyFactRow>

    <PropertyFactRow
        label='Ended'
        class='py-1'
    >
        <CopyField
            :model-value='ended ? toLocalInput(ended) : ""'
            :display='ended ? timediff(ended) : "Open Ended"'
            :title='ended ? new Date(ended).toLocaleString() : "Open Ended"'
            type='datetime-local'
            :edit='edit'
            :size='24'
            @submit='emit("update:ended", $event ? new Date(String($event)).toISOString() : null)'
        />
    </PropertyFactRow>
</template>

<script setup lang='ts'>
import CopyField from '../util/CopyField.vue';
import PropertyFactRow from '../util/PropertyFactRow.vue';
import timediff from '../../../timediff';

withDefaults(defineProps<{
    started: string;
    /** An Event without an ended time is open ended */
    ended: string | null;
    edit?: boolean;
}>(), {
    edit: false,
});

const emit = defineEmits<{
    (e: 'update:started', value: string): void
    (e: 'update:ended', value: string | null): void
}>();

function pad(n: number): string {
    return String(n).padStart(2, '0');
}

/** A datetime-local input takes local wall clock time without a zone */
function toLocalInput(iso: string): string {
    const time = new Date(iso);
    return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}T${pad(time.getHours())}:${pad(time.getMinutes())}`;
}

function validateStarted(value: string | number): false | string {
    return String(value) ? false : 'Started is required';
}
</script>
