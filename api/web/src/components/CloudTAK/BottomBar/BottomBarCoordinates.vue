<template>
    <div
        v-if='displayCoord'
        class='position-relative text-white user-select-none border-start border-white border-opacity-25 px-2 py-1'
        style='width: clamp(220px, 26vw, 340px); min-width: 220px; max-width: 340px;'
    >
        <TablerDropdown
            class='h-100'
            position='top-end'
            width='100%'
        >
            <template #default>
                <div
                    class='px-2 py-2 d-flex flex-column justify-content-center cursor-pointer cloudtak-hover h-100 pe-5'
                >
                    <span
                        class='d-block text-uppercase text-white-50'
                        style='font-size: 0.65rem; line-height: 1.1; letter-spacing: 0.04em;'
                    >{{ coordSource === 'gps' ? 'GPS Location' : 'Cursor Position' }}</span>
                    <span
                        class='d-block text-truncate'
                        style='font-size: 0.85rem; line-height: 1.2; font-variant-numeric: tabular-nums;'
                    >{{ formattedCoord }}</span>
                </div>
            </template>

            <template #dropdown>
                <li class='px-3 py-2'>
                    <TablerPillGroup
                        :model-value='coordSource'
                        :options='sourceOptions'
                        size='sm'
                        :full-width='true'
                        :rounded='true'
                        padding='px-1 py-0'
                        @click.stop
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

        <CopyButton
            v-tooltip='"Copy Coordinates"'
            :text='formattedCoord'
            class='position-absolute top-50 end-0 translate-middle-y me-2'
            :size='24'
            :stroke='1'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import { TablerDropdown, TablerPillGroup } from '@tak-ps/vue-tabler';
import {
    IconCursorText,
    IconCurrentLocation
} from '@tabler/icons-vue';
import { formatCoordPair, COORD_MODES, type CoordMode } from '../../../base/utils/coordinateFormat.ts';
import { useMapStore } from '../../../stores/map.ts';
import CopyButton from '../util/CopyButton.vue';

const props = defineProps<{
    coord: { lat: number; lng: number } | null;
}>();

const mapStore = useMapStore();

const coordSource = ref<string>('cursor');

const sourceOptions = [
    { value: 'cursor', label: 'Cursor' },
    { value: 'gps', label: 'GPS' }
];

const displayCoord = computed(() => {
    if (coordSource.value === 'gps') {
        return mapStore.gpsCoordinates;
    }
    return props.coord;
});

async function setCoordFormat(mode: CoordMode): Promise<void> {
    mapStore.coordFormat = mode;
    await mapStore.worker.profile.update({
        display_coordinate: mode
    });
}

const formattedCoord = computed(() => {
    const c = displayCoord.value;
    if (!c) return '';
    return formatCoordPair(
        c.lat,
        c.lng,
        mapStore.coordFormat as CoordMode,
        6
    );
});

</script>
