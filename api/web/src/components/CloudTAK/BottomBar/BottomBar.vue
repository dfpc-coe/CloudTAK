<template>
    <div class='position-absolute bottom-0 start-0 text-white map-status-bar'>
        <div class='d-flex align-items-stretch h-100'>
            <BottomBarCallsign
                :mode='mode'
                @set-location='$emit("set-location")'
                @to-location='$emit("to-location")'
            />
            <!-- Plugin bottom-bar components (centred) -->
            <div
                v-if='bottomBarItems.length'
                class='d-flex align-items-center justify-content-center gap-2 flex-grow-1 px-2 overflow-visible'
            >
                <div
                    v-for='item in bottomBarItems'
                    :key='item.key'
                    class='d-flex align-items-center flex-shrink-0 position-relative'
                >
                    <component :is='item.component' />
                </div>
            </div>
            <div
                v-else
                class='flex-grow-1'
            />
            <BottomBarCoordinates :coord='mouseCoord' />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useMapStore } from '../../../stores/map.ts';
import BottomBarCallsign from './BottomBarCallsign.vue';
import BottomBarCoordinates from './BottomBarCoordinates.vue';

defineProps<{
    mode: string;
    mouseCoord: { lat: number; lng: number } | null;
}>();

defineEmits(['set-location', 'to-location']);

const mapStore = useMapStore();

const bottomBarItems = computed(() => {
    try {
        return mapStore.bottomBar.pluginItems.value;
    } catch {
        return [];
    }
});
</script>

<style>
.map-status-bar {
    right: 0;
    z-index: 10;
    overflow: visible;
    height: var(--map-bottom-bar-size, 50px);
    background-color: rgba(0, 0, 0, 0.5);
}
</style>
