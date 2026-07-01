<template>
    <div
        class='cloudtak-navigating user-select-none'
    >
        <div class='d-flex align-items-center px-3 py-2 gap-2'>
            <IconRoute
                :size='28'
                stroke='1.5'
                class='flex-shrink-0'
            />

            <div
                class='flex-grow-1'
                style='min-width: 0;'
            >
                <div class='d-flex align-items-center gap-2'>
                    <span
                        class='fw-bold text-truncate'
                        v-text='mapStore.navigation.callsign || "Route"'
                    />
                </div>
                <div class='small text-secondary'>
                    <template v-if='state'>
                        <span v-text='`${remainingDisplay} to destination`' />
                    </template>
                    <template v-else>
                        Acquiring location…
                    </template>
                </div>
            </div>

            <div
                class='d-flex flex-column align-items-end px-2'
                style='min-width: 70px;'
            >
                <span
                    class='fw-bold'
                    style='font-size: 1.1rem; line-height: 1.1;'
                    v-text='speedDisplay'
                />
                <span
                    class='text-secondary'
                    style='font-size: 0.7rem;'
                    v-text='speedUnitLabel'
                />
            </div>

            <div
                class='d-none d-sm-flex flex-column align-items-end px-2'
                style='min-width: 70px;'
            >
                <span
                    class='fw-bold'
                    style='font-size: 1.1rem; line-height: 1.1;'
                    v-text='etaDisplay'
                />
                <span
                    class='text-secondary'
                    style='font-size: 0.7rem;'
                >ETA</span>
            </div>

            <div class='d-flex align-items-center gap-1 flex-shrink-0'>
                <TablerIconButton
                    title='Zoom to Route'
                    @click='zoomToRoute'
                >
                    <IconZoomPan
                        :size='24'
                        stroke='1.5'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Reverse Direction'
                    @click='mapStore.reverseNavigation()'
                >
                    <IconArrowsExchange
                        :size='24'
                        stroke='1.5'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='End Navigation'
                    @click='mapStore.stopNavigation()'
                >
                    <IconX
                        :size='24'
                        stroke='1.5'
                    />
                </TablerIconButton>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import {
    IconRoute,
    IconX,
    IconZoomPan,
    IconArrowsExchange,
} from '@tabler/icons-vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { useMapStore } from '../../stores/map.ts';
import ProfileConfig from '../../base/profile.ts';

const mapStore = useMapStore();

const units = ref({
    display_speed: 'mi/h',
    display_distance: 'mile'
});

onMounted(async () => {
    const displaySpeed = await ProfileConfig.get('display_speed');
    if (displaySpeed && displaySpeed.value) {
        units.value.display_speed = displaySpeed.value;
    }

    const displayDistance = await ProfileConfig.get('display_distance');
    if (displayDistance && displayDistance.value) {
        units.value.display_distance = displayDistance.value;
    }
});

const state = computed(() => mapStore.navigation.state);

// Convert a distance in kilometers into the user's preferred display unit.
function formatDistance(km: number): string {
    const unit = units.value.display_distance;
    if (unit === 'meter') {
        return `${Math.round(km * 1000).toLocaleString()} m`;
    } else if (unit === 'kilometer') {
        return `${(km).toFixed(km < 10 ? 2 : 1)} km`;
    } else {
        // Default to miles.
        return `${(km * 0.621371).toFixed(km * 0.621371 < 10 ? 2 : 1)} mi`;
    }
}

const totalRemaining = computed(() => {
    if (!state.value) return 0;
    return state.value.remaining + state.value.offRoute;
});

const remainingDisplay = computed(() => {
    if (!state.value) return '';
    return formatDistance(totalRemaining.value);
});

// gpsSpeed is reported in meters/second.
const speedUnitLabel = computed(() => (units.value.display_speed === 'km/h' ? 'km/h' : 'mph'));

const speedDisplay = computed(() => {
    const speed = mapStore.gpsSpeed;
    if (speed === null || speed <= 0) return '--';
    const converted = units.value.display_speed === 'km/h'
        ? speed * 3.6
        : speed * 2.236936;
    return converted.toFixed(converted < 10 ? 1 : 0);
});

const etaDisplay = computed(() => {
    const speed = mapStore.gpsSpeed;
    if (!state.value || speed === null || speed <= 0.3) return '--';

    // total distance (on-route remaining + off-route connector) in km -> m; speed is m/s.
    const seconds = (totalRemaining.value * 1000) / speed;
    if (!Number.isFinite(seconds)) return '--';

    if (seconds < 60) {
        return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
        return `${Math.round(seconds / 60)}m`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.round((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
});

async function zoomToRoute() {
    if (!mapStore.navigation.cotId) return;
    try {
        const cot = await mapStore.worker.db.get(mapStore.navigation.cotId);
        if (cot) await cot.flyTo();
    } catch (err) {
        console.error('Failed to zoom to route', err);
    }
}
</script>


