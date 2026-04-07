<template>
    <div class='position-absolute bottom-0 start-0 text-white map-status-bar'>
        <div class='d-flex align-items-stretch h-100'>
            <BottomBarCallsign
                :mode='mode'
                @set-location='$emit("set-location")'
                @to-location='$emit("to-location")'
            />
            <!-- Plugin bottom-bar icons (centred) -->
            <div
                v-if='bottomBarItems.length'
                class='d-flex align-items-center justify-content-center gap-1 flex-grow-1'
            >
                <TablerIconButton
                    v-for='item in bottomBarItems'
                    :key='item.key'
                    :title='item.tooltip'
                    :hover='false'
                    @click='item.onClick()'
                >
                    <component
                        :is='item.icon'
                        style='margin: 5px 8px'
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
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
import { TablerIconButton } from '@tak-ps/vue-tabler';
import BottomBarCallsign from './BottomBarCallsign.vue';
import BottomBarCoordinates from './BottomBarCoordinates.vue';

defineProps<{
    mode: string;
    mouseCoord: { lat: number; lng: number } | null;
}>();

defineEmits(['set-location', 'to-location']);

const mapStore = useMapStore();

const bottomBarItems = computed(() => mapStore.bottomBar.pluginItems.value);
</script>

<style>
.map-status-bar {
    right: 0;
    z-index: 4;
    height: var(--map-bottom-bar-size, 50px);
    background-color: rgba(0, 0, 0, 0.5);
}
</style>
