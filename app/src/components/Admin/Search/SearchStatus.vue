<template>
    <div
        v-if='props.status'
        class='d-flex align-items-center gap-1'
    >
        <span
            v-for='capability in capabilities'
            :key='capability'
            class='badge bg-blue-lt'
            v-text='capability'
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
import { computed } from 'vue';
import type { SearchProviderStatus } from '../../../types.ts';

const props = defineProps<{
    status?: SearchProviderStatus;
}>();

const capabilities = computed(() => {
    if (!props.status) return [];

    return [
        props.status.forward ? 'Forward' : '',
        props.status.reverse ? 'Reverse' : ''
    ].filter(Boolean);
});
</script>
