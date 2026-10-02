<template>
    <div
        v-if='props.status'
        class='d-flex align-items-center gap-1'
    >
        <span
            v-if='props.status.active'
            class='badge bg-blue-lt'
            v-text='`${props.status.modes} Travel ${props.status.modes === 1 ? "Mode" : "Modes"}`'
        />
        <span
            v-if='props.status.default'
            class='badge bg-blue-lt'
        >Default</span>
        <span
            class='badge'
            :class='props.status.active ? "bg-green-lt" : "bg-secondary-lt"'
            v-text='props.status.active ? "Active" : "Inactive"'
        />
    </div>
</template>

<script setup lang='ts'>
import type { RoutingProviderStatus } from '../../../types.ts';

const props = defineProps<{
    status?: RoutingProviderStatus;
}>();
</script>
