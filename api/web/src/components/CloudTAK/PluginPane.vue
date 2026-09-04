<template>
    <div
        v-if='pluginItems.length'
        class='position-absolute cloudtak-panel d-flex align-items-center gap-2 px-2 text-white plugin-pane'
    >
        <div
            v-for='item in pluginItems'
            :key='item.key'
            class='d-flex align-items-center flex-shrink-0 position-relative'
        >
            <component :is='item.component' />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { useMapStore } from '../../stores/map.ts';

const mapStore = useMapStore();

const pluginItems = computed(() => {
    try {
        return mapStore.bottomBar.pluginItems.value;
    } catch {
        return [];
    }
});
</script>

<style scoped>
.plugin-pane {
    z-index: 5;
    left: 50%;
    bottom: calc(8px + var(--map-bottom-inset, 0px));
    transform: translateX(-50%);
    height: 50px;
    overflow: visible;
}

@media (max-width: 600px) {
    .plugin-pane {
        bottom: calc(var(--map-gps-panel-size, 110px) + 16px + var(--map-bottom-inset, 0px));
    }
}
</style>
