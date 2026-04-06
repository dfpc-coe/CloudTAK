<template>
    <div
        class='position-absolute bottom-0 start-0 text-white map-status-bar'
        :class='{ "map-status-bar--stacked": mapStore.selected.size }'
    >
        <div class='d-flex align-items-center map-status-bar__content'>
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
    left: 0;
    right: var(--map-side-offset, 0px);
    z-index: 2;
    min-height: 40px;
    background-color: rgba(0, 0, 0, 0.5);
}

.map-status-bar--stacked {
}

.map-status-bar__content {
    min-height: 48px;
}

.map-status-bar__location {
    width: 40px;
    min-width: 40px;
}

.map-status-bar__details {
    flex: 0 1 auto;
    min-width: 0;
    max-width: fit-content;
}

.map-status-bar__coords {
    flex: 0 1 300px;
    width: clamp(220px, 26vw, 340px);
    min-width: 220px;
    max-width: 340px;
    border-left: 1px solid rgba(255, 255, 255, 0.12);
    padding: 4px 8px;
}

.map-status-bar__coords-trigger {
    min-height: 40px;
    padding-right: 44px !important;
}

.map-status-bar__coords-label {
    display: block;
    font-size: 0.65rem;
    line-height: 1.1;
    color: rgba(255, 255, 255, 0.65);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.map-status-bar__coords-text {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.85rem;
    line-height: 1.2;
    font-variant-numeric: tabular-nums;
}

.map-status-bar__coords-copy {
    top: 50%;
    right: 10px;
    transform: translateY(-50%);
}

.map-coord-menu {
    bottom: calc(100% + 4px);
    right: 0;
    min-width: 220px;
    background: rgba(20, 20, 25, 0.96);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    backdrop-filter: blur(8px);
    overflow: hidden;
    z-index: 10;
}

.map-coord-menu__item {
    padding: 9px 14px;
    cursor: pointer;
    color: #fff;
    transition: background 0.1s;
}

.map-coord-menu__item:hover {
    background: rgba(255, 255, 255, 0.1);
}

.map-coord-menu__item--active {
    background: rgba(var(--tblr-primary-rgb), 0.25);
    color: var(--tblr-primary);
}

.map-coord-menu__item--active .text-white-50 {
    color: rgba(var(--tblr-primary-rgb), 0.7) !important;
}
</style>
