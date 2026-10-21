<template>
    <StandardItem @click='$emit("click")'>
        <div class='d-flex align-items-start gap-3 px-3 py-2'>
            <div
                class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 mt-1 flex-shrink-0'
                style='width: 36px; height: 36px;'
            >
                <FeatureIcon
                    :key='device.type'
                    :size='24'
                    :feature='device.icon'
                />
            </div>

            <div class='flex-grow-1 overflow-hidden'>
                <div class='d-flex align-items-center gap-2'>
                    <StatusDot
                        :status='device.located && !device.stale ? "Success" : "Unknown"'
                        :title='device.stale ? "Stale" : device.located ? "On Map" : "Not on Map"'
                    />
                    <span class='fw-semibold text-truncate flex-grow-1'>{{ device.name }}</span>
                    <span
                        v-if='device.simulated'
                        class='badge bg-secondary text-secondary-fg flex-shrink-0 text-uppercase'
                    >Simulated</span>
                </div>
                <div
                    v-if='device.status || device.battery !== undefined'
                    class='small d-flex align-items-center gap-2 mt-1'
                    style='opacity: 0.85;'
                >
                    <span
                        v-if='device.status'
                        class='d-flex align-items-center'
                    >
                        <IconHeartbeat
                            :size='14'
                            stroke='1.5'
                            class='me-1 flex-shrink-0'
                        />
                        <span
                            class='text-truncate'
                            v-text='device.status'
                        />
                    </span>
                    <span
                        v-if='device.battery !== undefined'
                        class='d-flex align-items-center'
                    >
                        <IconBattery
                            :size='14'
                            stroke='1.5'
                            class='me-1 flex-shrink-0'
                        />
                        {{ device.battery }}%
                    </span>
                </div>
                <div
                    v-if='device.hardware'
                    class='text-muted small text-truncate'
                    v-text='device.hardware'
                />
                <div class='text-muted small d-flex align-items-center'>
                    <IconClock
                        :size='14'
                        stroke='1.5'
                        class='me-1 flex-shrink-0'
                    />
                    <span>{{ new Date(device.updated).toLocaleString() }}</span>
                    <span
                        v-if='!device.located'
                        class='ms-auto fst-italic'
                    >Not on map</span>
                    <span
                        v-else-if='device.stale'
                        class='ms-auto fst-italic'
                    >Stale</span>
                </div>
            </div>

            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script lang='ts'>
/**
 * A Device row as rendered in lists - built either from the Device API
 * response or from the Device's locally cached CoT when offline
 */
export type DeviceRow = {
    id: string;
    name: string;
    type: string;
    updated: string;
    located: boolean;
    stale: boolean;
    simulated: boolean;
    status?: string;
    battery?: number;
    hardware?: string;
    source: 'api' | 'local';
    icon: {
        properties: Record<string, unknown>;
    };
};

export default {
    name: 'StandardCoreDevice'
};
</script>

<script setup lang='ts'>
import StandardItem from './StandardItem.vue';
import FeatureIcon from './FeatureIcon.vue';
import StatusDot from '../../util/StatusDot.vue';
import {
    IconClock,
    IconBattery,
    IconHeartbeat,
} from '@tabler/icons-vue';

defineProps<{
    device: DeviceRow;
}>();

defineEmits<{
    (e: 'click'): void;
}>();
</script>
