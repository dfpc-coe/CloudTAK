<template>
    <StandardItem
        class='core-row w-100 d-flex flex-row gap-3 align-items-center px-2 py-2'
        @click='$emit("click")'
    >
        <span
            class='avatar avatar-sm rounded-circle core-row__icon flex-shrink-0'
            :title='device.type'
        >
            <FeatureIcon
                :key='device.type'
                :size='24'
                :feature='device.icon'
            />
        </span>

        <div
            class='flex-grow-1 d-flex flex-column'
            style='min-width: 0;'
        >
            <span class='d-flex align-items-center gap-2'>
                <StatusDot
                    :status='device.located && !device.stale ? "Success" : "Unknown"'
                    :title='device.stale ? "Stale" : device.located ? "On Map" : "Not on Map"'
                />
                <span
                    class='fw-semibold text-truncate'
                    v-text='device.name'
                />
            </span>
            <span
                class='text-secondary small text-truncate'
                v-text='subtitle'
            />
        </div>

        <span
            v-if='device.simulated'
            class='badge bg-secondary text-secondary-fg flex-shrink-0 text-uppercase'
        >Simulated</span>

        <slot name='actions' />
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
import { computed } from 'vue';
import StandardItem from './StandardItem.vue';
import FeatureIcon from './FeatureIcon.vue';
import StatusDot from '../../util/StatusDot.vue';
import timediff from '../../../timediff';

const props = defineProps<{
    device: DeviceRow;
}>();

defineEmits<{
    (e: 'click'): void;
}>();

const subtitle = computed(() => {
    const state = !props.device.located ? 'Not on map' : props.device.stale ? 'Stale' : undefined;
    const battery = props.device.battery !== undefined ? `${props.device.battery}%` : undefined;

    return [
        props.device.hardware,
        props.device.status,
        battery,
        state,
        timediff(props.device.updated),
    ].filter(Boolean).join(' · ');
});
</script>

<style scoped>
.core-row__icon {
    --tblr-avatar-size: 2.25rem;
    color: var(--tblr-body-color);
    background-color: var(--cloudtak-inset-bg, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--cloudtak-inset-border, rgba(255, 255, 255, 0.12));
    transition: border-color 0.15s ease, color 0.15s ease;
}

.core-row:hover .core-row__icon,
.core-row:focus-within .core-row__icon {
    border-color: rgba(var(--tblr-primary-rgb), 0.4);
}
</style>
