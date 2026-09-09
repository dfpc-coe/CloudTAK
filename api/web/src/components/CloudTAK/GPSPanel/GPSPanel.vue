<template>
    <div
        v-if='!hidden'
        class='position-absolute cloudtak-panel d-flex flex-column justify-content-center user-select-none gps-panel'
        :title='locationTooltip'
    >
        <div
            class='cursor-pointer'
            title='Zoom To Location'
            data-test='to-location'
            @click='$emit("to-location")'
        >
            <div class='d-flex align-items-center gap-2'>
                <span
                    class='flex-grow-1 text-truncate fw-semibold gps-panel-callsign'
                >{{ mapStore.callsign }}</span>

                <TablerIconButton
                    :title='locationTooltip'
                    :hover='false'
                    class='flex-shrink-0'
                    data-test='set-location'
                    @click.stop='$emit("set-location")'
                >
                    <IconLocation
                        v-if='mapStore.location === LocationState.Live'
                        :size='18'
                        stroke='1'
                        :color='locationColor'
                    />
                    <IconLocationPin
                        v-else-if='mapStore.location === LocationState.Preset'
                        :size='18'
                        stroke='1'
                    />
                    <IconLocationOff
                        v-else
                        :size='18'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>

            <div
                class='d-flex justify-content-between gap-3 gps-panel-row'
                style='font-variant-numeric: tabular-nums;'
            >
                <span data-test='altitude'>{{ altitudeText }}</span>
                <span
                    data-test='accuracy'
                    class='text-secondary'
                >{{ accuracyText }}</span>
            </div>

            <div
                class='d-flex justify-content-between gap-3 gps-panel-row'
                style='font-variant-numeric: tabular-nums;'
            >
                <span data-test='speed'>{{ speedText }}</span>
                <span data-test='heading'>{{ headingText }}</span>
            </div>
        </div>

        <GPSPanelCoordinates />
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { LocationState } from '../../../utils/events.ts';
import { useMapStore } from '../../../stores/map.ts';
import { useAppStore } from '../../../stores/app.ts';
import { DrawToolMode } from '../../../stores/modules/draw.ts';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import {
    IconLocation,
    IconLocationPin,
    IconLocationOff,
} from '@tabler/icons-vue';
import GPSPanelCoordinates from './GPSPanelCoordinates.vue';

const props = defineProps<{
    mode: string;
}>();

defineEmits(['set-location', 'to-location']);

const mapStore = useMapStore();
const appStore = useAppStore();

// On small screens the bottom panes overlap the GPS panel, so hide it while they are shown
const hidden = computed(() => {
    if (!appStore.isMobileDetected) return false;
    return props.mode === 'SetLocation' || mapStore.draw.mode !== DrawToolMode.STATIC;
});

const isLive = computed(() => {
    return mapStore.location === LocationState.Live && !mapStore.manualLocationMode;
});

const locationAccuracy = computed(() => {
    if (!isLive.value) return undefined;
    return mapStore.locationAccuracy;
});

const locationColor = computed(() => {
    if (!locationAccuracy.value) return 'currentColor';
    const accuracy = locationAccuracy.value;
    if (accuracy <= 50) return '#22c55e';
    if (accuracy <= 200) return '#eab308';
    return '#ef4444';
});

const locationTooltip = computed(() => {
    if (props.mode === 'SetLocation') return 'Click on map to set location';
    if (mapStore.location === LocationState.Preset) return 'Manual Location - Click to adjust or switch to GPS';
    if (mapStore.location === LocationState.Live) return 'Live Location - Click to set manually';
    if (mapStore.location === LocationState.Loading) return 'Acquiring GPS';
    return 'Set Your Location - Click to enable GPS or set manually';
});

function formatLength(meters: number, unit: string): string {
    if (unit === 'feet' || unit === 'mile') return `${Math.round(meters * 3.28084)} ft`;
    return `${Math.round(meters)} m`;
}

const altitudeText = computed(() => {
    const alt = isLive.value ? mapStore.gpsAltitude : null;
    if (alt === null) return mapStore.elevationUnit === 'feet' ? '-- ft MSL' : '-- m MSL';
    return `${formatLength(alt, mapStore.elevationUnit)} MSL`;
});

const accuracyText = computed(() => {
    if (props.mode === 'SetLocation') return 'Click map';
    if (mapStore.location === LocationState.Preset) return 'Manual';
    if (mapStore.location === LocationState.Loading) return 'Acquiring';
    if (!locationAccuracy.value) return isLive.value ? 'GPS' : 'No Fix';
    return `+/- ${formatLength(locationAccuracy.value, mapStore.distanceUnit)}`;
});

const speedText = computed(() => {
    const speed = isLive.value ? mapStore.gpsSpeed : null;
    const unit = mapStore.speedUnit;
    const label = unit === 'mi/h' ? 'MPH' : unit === 'km/h' ? 'km/h' : 'm/s';
    if (speed === null) return `-- ${label}`;
    if (unit === 'mi/h') return `${Math.round(speed * 2.23694)} ${label}`;
    if (unit === 'km/h') return `${Math.round(speed * 3.6)} ${label}`;
    return `${Math.round(speed)} ${label}`;
});

const headingText = computed(() => {
    const heading = mapStore.deviceHeading ?? (isLive.value ? mapStore.gpsHeading : null);
    if (heading === null) return '--°';
    return `${((Math.round(heading) % 360) + 360) % 360}°`;
});
</script>

<style scoped>
.gps-panel {
    z-index: 5;
    left: calc(8px + env(safe-area-inset-left, 0px));
    bottom: calc(8px + env(safe-area-inset-bottom, 0px));
    height: var(--map-gps-panel-size, 84px);
    width: fit-content;
    min-width: 180px;
    max-width: calc(100vw - 16px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
    padding: 0.25rem 0.75rem;
    overflow: visible;
}

.gps-panel-callsign {
    font-size: 0.9rem;
    line-height: 1.2;
}

.gps-panel-row {
    font-size: 0.75rem;
    line-height: 1.25;
}

@media (max-width: 600px) {
    .gps-panel {
        max-width: calc(100vw - 70px - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
    }
}
</style>
