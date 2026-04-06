<template>
    <div
        v-if='coord'
        class='map-status-bar__coords position-relative text-white user-select-none ms-auto'
    >
        <div
            class='map-status-bar__coords-trigger rounded text-truncate px-2 py-2 d-flex flex-column justify-content-center cursor-pointer hover-button h-100'
            @click='showMenu = !showMenu'
        >
            <span class='map-status-bar__coords-label'>Cursor Position</span>
            <span class='map-status-bar__coords-text'>{{ formattedCoord }}</span>
        </div>

        <CopyButton
            v-tooltip='"Copy Coordinates"'
            :text='formattedCoord'
            class='map-status-bar__coords-copy position-absolute'
            :size='24'
            :stroke='1'
        />

        <!-- drop-up format selector -->
        <div
            v-if='showMenu'
            class='map-coord-menu position-absolute'
            @click.stop
        >
            <div
                v-for='mode in COORD_MODES'
                :key='mode.value'
                class='map-coord-menu__item'
                :class='{ "map-coord-menu__item--active": mapStore.coordFormat === mode.value }'
                @click='mapStore.coordFormat = mode.value; showMenu = false'
            >
                <span class='fw-semibold'>{{ mode.label }}</span>
                <span class='text-white-50 ms-2' style='font-size: 0.75rem;'>{{ mode.title }}</span>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch } from 'vue';
import { formatCoordPair, COORD_MODES, type CoordMode } from '../../../base/utils/coordinateFormat.ts';
import { useMapStore } from '../../../stores/map.ts';
import CopyButton from '../util/CopyButton.vue';

const props = defineProps<{
    coord: { lat: number; lng: number } | null;
}>();

const mapStore = useMapStore();
const showMenu = ref(false);

// Close menu when cursor leaves the map (coord becomes null)
watch(() => props.coord, (val) => {
    if (!val) showMenu.value = false;
});

const formattedCoord = computed(() => {
    if (!props.coord) return '';
    return formatCoordPair(
        props.coord.lat,
        props.coord.lng,
        mapStore.coordFormat as CoordMode,
        6
    );
});

</script>
