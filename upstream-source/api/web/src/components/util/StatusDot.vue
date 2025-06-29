<template>
    <span
        v-tooltip='props.title || props.status'
        class='status-indicator status-indicator-animated'
        :class='{
            "status-yellow": ["running", "pending"].includes(normalizeStatus),
            "status-orange": ["warn", "provisioning"].includes(normalizeStatus),
            "status-green": ["success"].includes(normalizeStatus),
            "status-red": ["fail", "pending", "deprovisioning"].includes(normalizeStatus),
            "status-dark": !props.dark && ["unknown", "empty"].includes(normalizeStatus),
            "status-light": props.dark && ["unknown", "empty"].includes(normalizeStatus),
        }'
    >
        <span class='status-indicator-circle' />
        <span class='status-indicator-circle' />
        <span class='status-indicator-circle' />
    </span>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
const props = defineProps<{
    title?: string,
    status: string,
    dark?: boolean
}>();

const normalizeStatus = computed(() => {
    return (props.status ?? '').toLowerCase()
});
</script>
