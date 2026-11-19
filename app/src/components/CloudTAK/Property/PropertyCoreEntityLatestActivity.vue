<template>
    <button
        type='button'
        class='latest-activity w-100 text-start d-flex align-items-center gap-2 px-2 py-2 rounded border-0'
        :class='entry ? "latest-activity--filled" : "latest-activity--empty"'
        :title='entry ? "Open the Timeline" : "Add a note to the Timeline"'
        @click='emit("open")'
    >
        <TimelineTypeIcon
            :type='entry ? entry.type : "comment"'
            :muted='!entry'
        />

        <div
            class='flex-grow-1 d-flex flex-column'
            style='min-width: 0;'
        >
            <template v-if='entry'>
                <div class='d-flex align-items-center gap-2'>
                    <span class='subheader text-primary'>Latest</span>
                    <span
                        class='small text-secondary text-truncate'
                        :title='new Date(entry.occurred).toLocaleString()'
                        v-text='`${timediff(entry.occurred)} · ${entry.author}`'
                    />
                </div>
                <span
                    class='text-truncate'
                    v-text='entry.body || `${entry.type} entry`'
                />
            </template>
            <template v-else>
                <span class='text-secondary'>No activity yet</span>
            </template>
        </div>

        <CountBadge
            v-if='entry && total'
            :count='total'
        />
        <span
            v-else-if='edit'
            class='small text-primary flex-shrink-0'
        >Add a note</span>
    </button>
</template>

<script setup lang='ts'>
/** PropertyCoreEntityLatestActivity - the newest Timeline entry of a Core Event, as a jump to the Timeline tab */
import timediff from '../../../timediff';
import CountBadge from '../util/CountBadge.vue';
import TimelineTypeIcon from './PropertyCoreEntityTimelineIcon.vue';
import type { CoreEntityTimelineEntry } from '../../../types.ts';

defineProps<{
    entry?: CoreEntityTimelineEntry;
    total: number;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'open'): void;
}>();
</script>

<style scoped>
.latest-activity {
    color: inherit;
    cursor: pointer;
}

.latest-activity--filled {
    background: rgba(59, 130, 246, 0.08);
    outline: 1px solid rgba(59, 130, 246, 0.25);
}

.latest-activity--filled:hover {
    background: rgba(59, 130, 246, 0.14);
}

.latest-activity--empty {
    background: transparent;
    outline: 1px dashed var(--cloudtak-inset-border);
}

.latest-activity--empty:hover {
    background: var(--cloudtak-hover-bg);
}
</style>
