<template>
    <TablerBadge
        background-color='rgba(59, 130, 246, 0.15)'
        border-color='rgba(59, 130, 246, 0.4)'
        text-color='#3b82f6'
    >
        {{ count }}
    </TablerBadge>
</template>

<script setup lang='ts'>
import { TablerBadge } from '@tak-ps/vue-tabler';

defineProps<{
    count: number;
}>();
</script>
