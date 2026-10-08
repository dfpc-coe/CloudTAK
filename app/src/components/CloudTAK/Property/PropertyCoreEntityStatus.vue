<template>
    <div class='d-flex align-items-center gap-2 px-3 py-2 border-bottom cloudtak-header flex-shrink-0'>
        <StatusDot
            :status='active ? "Success" : "Unknown"'
            :title='active ? "Active" : "Ended"'
        />
        <span
            class='fw-semibold user-select-none'
            v-text='active ? "Active" : "Ended"'
        />
        <TablerBadge
            v-if='priority !== "none"'
            :background-color='badge.background'
            :border-color='badge.border'
            :text-color='badge.text'
        >
            {{ badge.label }}
        </TablerBadge>
        <span
            class='text-secondary small text-truncate user-select-none'
            style='min-width: 0;'
            v-text='summary'
        />
        <button
            v-if='edit'
            type='button'
            class='btn btn-sm ms-auto flex-shrink-0'
            @click='emit("update:active", !active)'
        >
            <IconPlayerStop
                v-if='active'
                :size='16'
                stroke='1.5'
                class='me-1'
            />
            <IconPlayerPlay
                v-else
                :size='16'
                stroke='1.5'
                class='me-1'
            />
            {{ active ? 'End' : 'Reactivate' }}
        </button>
    </div>
</template>

<script setup lang='ts'>
/**
 * PropertyCoreEntityStatus - the one-line status strip under the Event
 * header: whether it is active, its priority and its time window
 */
import { computed } from 'vue';
import { TablerBadge } from '@tak-ps/vue-tabler';
import { IconPlayerStop, IconPlayerPlay } from '@tabler/icons-vue';
import StatusDot from '../../util/StatusDot.vue';
import timediff from '../../../timediff';
import { priorityBadge } from '../../../utils/priority.ts';

const props = defineProps<{
    active: boolean;
    priority: string;
    started: string;
    ended: string | null;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:active', value: boolean): void
}>();

const badge = computed(() => priorityBadge(props.priority));

const summary = computed(() => {
    const started = `Started ${timediff(props.started)}`;

    if (!props.ended) return `${started} · Open ended`;

    return `${started} · ${props.active ? 'Ends' : 'Ended'} ${timediff(props.ended)}`;
});
</script>
