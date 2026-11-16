<template>
    <TablerPillGroup
        :model-value='String(route.name)'
        class='pt-2'
        :options='tabs'
        @update:model-value='navigate'
    >
        <template #option='{ option }'>
            <span
                class='d-inline-flex align-items-center'
                :title='option.label'
            >
                <component
                    :is='icons[option.value]'
                    :size='20'
                    stroke='1'
                />
                <span
                    class='ms-1'
                    v-text='option.label'
                />
            </span>
        </template>
    </TablerPillGroup>
</template>

<script setup lang='ts'>
import type { Component } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { TablerPillGroup } from '@tak-ps/vue-tabler';
import {
    IconCpu,
    IconMapPin,
    IconCalendarEvent,
} from '@tabler/icons-vue';

const route = useRoute();
const router = useRouter();

const tabs = [
    { value: 'home-menu-features', label: 'Features' },
    { value: 'home-menu-features-events', label: 'Events' },
    { value: 'home-menu-features-devices', label: 'Devices' },
];

const icons: Record<string, Component> = {
    'home-menu-features': IconMapPin,
    'home-menu-features-events': IconCalendarEvent,
    'home-menu-features-devices': IconCpu,
};

function navigate(name: string): void {
    if (name === route.name) return;
    router.replace({ name });
}
</script>
