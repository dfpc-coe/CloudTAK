<template>
    <StandardItem @click='$emit("click")'>
        <div class='d-flex align-items-start gap-3 px-3 py-2'>
            <div
                class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 mt-1 flex-shrink-0'
                style='width: 36px; height: 36px;'
            >
                <IconCalendarEvent
                    :size='18'
                    stroke='1.5'
                    :class='priorityClass'
                />
            </div>

            <div class='flex-grow-1 overflow-hidden'>
                <div class='d-flex align-items-center gap-2'>
                    <StatusDot
                        :status='event.ended ? "Unknown" : "Success"'
                        :title='event.ended ? "Ended" : "Active"'
                    />
                    <span class='fw-semibold text-truncate flex-grow-1'>{{ event.name }}</span>
                    <span
                        v-if='event.priority !== "none"'
                        class='badge flex-shrink-0 text-uppercase'
                        :class='priorityBadgeClass'
                    >{{ event.priority }}</span>
                    <span class='text-muted small flex-shrink-0'>{{ new Date(event.created).toLocaleString() }}</span>
                </div>
                <div
                    v-if='event.location'
                    class='text-truncate small'
                    style='opacity: 0.85;'
                    v-text='event.location'
                />
                <div class='text-muted small text-truncate'>
                    {{ creator }}
                    <template v-if='event.ended'>
                        &middot; Ended {{ new Date(event.ended).toLocaleString() }}
                    </template>
                </div>
            </div>

            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import StandardItem from './StandardItem.vue';
import StatusDot from '../../util/StatusDot.vue';
import { IconCalendarEvent } from '@tabler/icons-vue';
import type { CoreEvent } from '../../../types.ts';

const props = defineProps<{
    event: CoreEvent;
}>();

defineEmits<{
    (e: 'click'): void;
}>();

const creator = computed(() => {
    if (props.event.username) return props.event.username;
    if (props.event.connection !== null) return `Connection #${props.event.connection}`;
    return 'Unknown Creator';
});

const priorityClass = computed(() => {
    return {
        critical: 'text-danger',
        high: 'text-orange',
        medium: 'text-yellow',
        low: 'text-blue',
        none: 'text-secondary',
    }[props.event.priority] || 'text-secondary';
});

const priorityBadgeClass = computed(() => {
    return {
        critical: 'bg-red text-red-fg',
        high: 'bg-orange text-orange-fg',
        medium: 'bg-yellow text-yellow-fg',
        low: 'bg-blue text-blue-fg',
        none: 'bg-secondary text-secondary-fg',
    }[props.event.priority] || 'bg-secondary text-secondary-fg';
});
</script>
