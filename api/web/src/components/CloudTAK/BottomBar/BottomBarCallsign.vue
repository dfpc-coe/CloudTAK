<template>
    <div
        class='rounded hover-button h-100 d-flex align-items-center justify-content-center flex-shrink-0'
        style='width: 40px; min-width: 40px;'
    >
        <TablerIconButton
            v-if='mapStore.location === LocationState.Live'
            :title='locationTooltip'
            :hover='false'
            @click='$emit("set-location")'
        >
            <IconLocation
                style='margin: 5px 8px'
                :size='20'
                stroke='1'
                :color='locationColor'
            />
        </TablerIconButton>
        <TablerIconButton
            v-else-if='mapStore.location === LocationState.Preset'
            :title='locationTooltip'
            :hover='false'
            @click='$emit("set-location")'
        >
            <IconLocationPin
                title='Manual Location - Click to enable GPS'
                style='margin: 5px 8px'
                :size='20'
                stroke='1'
            />
        </TablerIconButton>
        <TablerIconButton
            v-else
            title='Set Your Location Button'
            :hover='false'
            @click='$emit("set-location")'
        >
            <IconLocationOff
                title='Set Your Location Button (No Location currently set)'
                style='margin: 5px 8px'
                :size='20'
                stroke='1'
            />
        </TablerIconButton>
    </div>
    <div
        v-tooltip='"Zoom To Location"'
        class='rounded text-truncate px-2 py-2 d-flex flex-column justify-content-center text-white user-select-none cursor-pointer hover-button h-100 flex-shrink-1'
        style='min-width: 0; max-width: fit-content;'
        @click='$emit("to-location")'
    >
        <span
            class='fw-semibold'
            style='line-height: 1.2;'
        >{{ mapStore.callsign }}</span>
        <span
            class='text-white-50'
            style='font-size: 0.7rem; line-height: 1.2;'
        >{{ locationStatusText }}</span>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import { LocationState } from '../../../base/events.ts';
import { useMapStore } from '../../../stores/map.ts';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import {
    IconLocation,
    IconLocationPin,
    IconLocationOff,
} from '@tabler/icons-vue';

const props = defineProps<{
    mode: string;
}>();

defineEmits(['set-location', 'to-location']);

const mapStore = useMapStore();

const locationAccuracy = ref<number | undefined>(undefined);

watch(() => mapStore.location, async () => {
    if (mapStore.location === LocationState.Live && !mapStore.manualLocationMode) {
        try {
            const location = await mapStore.worker.profile.location;
            locationAccuracy.value = location.accuracy;
        } catch {
            locationAccuracy.value = undefined;
        }
    } else {
        locationAccuracy.value = undefined;
    }
}, { immediate: true });

const locationColor = computed(() => {
    if (mapStore.location !== LocationState.Live || !locationAccuracy.value) return '#ffffff';
    const accuracy = locationAccuracy.value;
    if (accuracy <= 50) return '#22c55e';
    if (accuracy <= 200) return '#eab308';
    return '#ef4444';
});

const locationTooltip = computed(() => {
    if (props.mode === 'SetLocation') return 'Click on map to set location';
    if (mapStore.location === LocationState.Preset) return 'Manual Location - Click to adjust or switch to GPS';
    if (mapStore.location === LocationState.Live && locationAccuracy.value) {
        const accuracy = locationAccuracy.value;
        if (mapStore.distanceUnit === 'mile') {
            return `Live Location (±${Math.round(accuracy * 3.28084)}ft) - Click to set manually`;
        }
        return `Live Location (±${Math.round(accuracy)}m) - Click to set manually`;
    }
    return 'Set Your Location - Click to enable GPS or set manually';
});

const locationStatusText = computed(() => {
    if (props.mode === 'SetLocation') return 'Click map to set location';
    if (mapStore.location === LocationState.Preset) return 'Manual location';
    if (mapStore.location === LocationState.Live && locationAccuracy.value) {
        if (mapStore.distanceUnit === 'mile') return `GPS ±${Math.round(locationAccuracy.value * 3.28084)}ft`;
        return `GPS ±${Math.round(locationAccuracy.value)}m`;
    }
    if (mapStore.location === LocationState.Live) return 'GPS active';
    if (mapStore.location === LocationState.Loading) return 'Acquiring GPS';
    return 'Location not set';
});
</script>
