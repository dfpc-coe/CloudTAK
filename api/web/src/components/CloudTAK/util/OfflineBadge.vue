<template>
    <TablerBadge
        class='small d-inline-flex align-items-center flex-shrink-0 fw-semibold'
        background-color='#206bc4'
        border-color='#206bc4'
        text-color='#ffffff'
        :title='title'
    >
        <IconDeviceMobileCheck
            :size='14'
            stroke='2'
            class='me-1'
        />
        Offline
    </TablerBadge>
</template>

<script setup lang='ts'>
import { IconDeviceMobileCheck } from '@tabler/icons-vue';
import { TablerBadge } from '@tak-ps/vue-tabler';

withDefaults(defineProps<{
    title?: string
}>(), {
    title: 'Available offline on this device'
});
</script>
