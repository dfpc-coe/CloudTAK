<template>
    <StandardItem>
        <div class='d-flex align-items-center gap-3 px-3 py-2'>
            <StatusDot :status='session.active ? "Success" : "Unknown"' />
            <div class='flex-grow-1 overflow-hidden'>
                <div class='d-flex align-items-center gap-2 fw-bold'>
                    <component
                        :is='deviceIcon'
                        :size='16'
                        stroke='1.5'
                        class='flex-shrink-0'
                    />
                    <span class='text-truncate'>{{ session.browser || 'Unknown Browser' }}</span>
                </div>
                <div class='text-muted small text-truncate'>
                    {{ session.os }}
                    <template v-if='session.os && session.device_type'>
                        &middot;
                    </template>
                    {{ session.device_type }}
                </div>
                <div class='text-muted small text-truncate'>
                    {{ session.ip }} &middot; {{ new Date(session.created).toLocaleString() }}
                </div>
            </div>
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import StandardItem from './StandardItem.vue';
import StatusDot from '../../util/StatusDot.vue';
import {
    IconDeviceDesktop,
    IconDeviceMobile,
    IconDeviceTablet,
} from '@tabler/icons-vue';

const props = defineProps<{
    session: {
        id: string;
        username: string;
        created: string;
        ip: string;
        device_type: string;
        browser: string;
        os: string;
        user_agent: string;
        active: boolean;
    };
}>();

const deviceIcon = computed(() => {
    const type = props.session.device_type?.toLowerCase();
    if (type === 'mobile') return IconDeviceMobile;
    if (type === 'tablet') return IconDeviceTablet;
    return IconDeviceDesktop;
});
</script>
