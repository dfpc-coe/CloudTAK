<template>
    <div class='position-relative'>
        <TablerDropdown
            position='top-start'
            :width='240'
        >
            <template #default>
                <div
                    class='d-flex align-items-center gap-2 rounded'
                    :class='isNative ? "" : "cursor-pointer cloudtak-hover"'
                    :title='coordSource === "gps" ? "GPS Location - Click to change format" : "Cursor Position - Click to change format"'
                >
                    <IconCursorText
                        v-if='coordSource === "cursor"'
                        class='flex-shrink-0 text-white-50'
                        :size='14'
                        stroke='1'
                    />
                    <span
                        class='text-truncate'
                        style='font-size: 0.95rem; line-height: 1.4; font-variant-numeric: tabular-nums;'
                        data-test='coordinates'
                    >{{ formattedCoord }}</span>
                </div>
            </template>

            <template #dropdown>
                <li
                    v-if='!isNative'
                    class='px-3 py-2'
                    @click.stop
                >
                    <TablerPillGroup
                        :model-value='coordSource'
                        :options='sourceOptions'
                        size='sm'
                        :full-width='true'
                        :rounded='true'
                        padding='px-1 py-0'
                        @update:model-value='coordSource = $event'
                    >
                        <template #option='{ option }'>
                            <IconCursorText
                                v-if='option.value === "cursor"'
                                :size='16'
                                stroke='1'
                            />
                            <IconCurrentLocation
                                v-else
                                :size='16'
                                stroke='1'
                            />
                            <span class='ms-1'>{{ option.label }}</span>
                        </template>
                    </TablerPillGroup>
                </li>
                <li
                    v-if='displayCoord'
                    class='px-3 py-2'
                    @click.stop='void copy()'
                >
                    <button
                        type='button'
                        class='btn btn-outline-secondary w-100 d-flex align-items-center justify-content-center gap-2'
                        data-test='copy'
                    >
                        <IconCopyCheck
                            v-if='copied'
                            :size='16'
                            stroke='1'
                        />
                        <IconCopy
                            v-else
                            :size='16'
                            stroke='1'
                        />
                        {{ copied ? 'Copied' : 'Copy' }}
                    </button>
                </li>
                <li
                    v-for='mode in COORD_MODES'
                    :key='mode.value'
                    class='tabler-dropdown__item cloudtak-hover cursor-pointer px-3 py-2 text-body'
                    :class='{ "tabler-dropdown__item--active": mapStore.coordFormat === mode.value }'
                    @click='void setCoordFormat(mode.value)'
                >
                    <span class='fw-semibold'>{{ mode.label }}</span>
                    <span class='text-secondary ms-2 small'>{{ mode.title }}</span>
                </li>
            </template>
        </TablerDropdown>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { MapMouseEvent } from 'maplibre-gl';
import { Clipboard } from '@capacitor/clipboard';
import { TablerDropdown, TablerPillGroup } from '@tak-ps/vue-tabler';
import {
    IconCopy,
    IconCopyCheck,
    IconCursorText,
    IconCurrentLocation
} from '@tabler/icons-vue';
import { formatCoordPair, COORD_MODES, type CoordMode } from '../../../utils/coordinateFormat.ts';
import { useMapStore } from '../../../stores/map.ts';
import { isNativePlatform } from '../../../utils/capacitor.ts';

const mapStore = useMapStore();

const isNative = isNativePlatform();

const coordSource = ref<string>('gps');

const copied = ref(false);
let copiedTimeout: ReturnType<typeof setTimeout> | undefined;

async function copy(): Promise<void> {
    await Clipboard.write({ string: formattedCoord.value });
    copied.value = true;

    if (copiedTimeout) clearTimeout(copiedTimeout);
    copiedTimeout = setTimeout(() => {
        copied.value = false;
    }, 1000);
}

// The cursor position is tracked here rather than in Map.vue so that a
// mousemove only re-renders this readout, not the whole map shell, and
// ref writes are throttled to one per animation frame
const cursorCoord = ref<{ lat: number; lng: number } | null>(null);

let pendingCoord: { lat: number; lng: number } | null = null;
let rafId: number | null = null;

function onMouseMove(e: MapMouseEvent): void {
    const lngLat = e.lngLat.wrap();

    pendingCoord = {
        lat: lngLat.lat,
        lng: lngLat.lng,
    };

    if (rafId === null) {
        rafId = requestAnimationFrame(() => {
            rafId = null;
            cursorCoord.value = pendingCoord;
        });
    }
}

function onMouseOut(): void {
    pendingCoord = null;

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    cursorCoord.value = null;
}

onMounted(() => {
    mapStore.map.on('mousemove', onMouseMove);
    mapStore.map.on('mouseout', onMouseOut);
});

onBeforeUnmount(() => {
    if (copiedTimeout) clearTimeout(copiedTimeout);

    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    if (!mapStore._map) return;
    mapStore.map.off('mousemove', onMouseMove);
    mapStore.map.off('mouseout', onMouseOut);
});

const sourceOptions = [
    { value: 'cursor', label: 'Cursor' },
    { value: 'gps', label: 'GPS' }
];

const displayCoord = computed(() => {
    if (coordSource.value === 'gps') {
        return mapStore.gpsCoordinates;
    }

    return cursorCoord.value;
});

async function setCoordFormat(mode: CoordMode): Promise<void> {
    mapStore.coordFormat = mode;
    await mapStore.worker.profile.update({
        display_coordinate: mode
    });
}

const formattedCoord = computed(() => {
    const c = displayCoord.value;

    if (!c) return coordSource.value === 'cursor' ? 'Cursor Offscreen' : 'No GPS Fix';

    return formatCoordPair(
        c.lat,
        c.lng,
        mapStore.coordFormat as CoordMode,
        5
    );
});

</script>
