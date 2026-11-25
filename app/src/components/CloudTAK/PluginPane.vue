<template>
    <div
        v-if='pluginItems.length'
        class='position-absolute cloudtak-panel d-flex align-items-center gap-2 px-2 plugin-pane'
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
import { computed, onBeforeUnmount, watch } from 'vue';
import { useMapStore } from '../../stores/map.ts';

const emit = defineEmits<{
    (e: 'shown', shown: boolean): void;
}>();

const mapStore = useMapStore();

const pluginItems = computed(() => {
    try {
        return mapStore.bottomBar.pluginItems.value;
    } catch {
        return [];
    }
});

// On small screens the pane sits above the GPS panel, where the Selected Features window is too. The map
// moves that window up by the pane's height while the pane is shown
watch(() => pluginItems.value.length > 0, (shown) => emit('shown', shown), { immediate: true });
onBeforeUnmount(() => emit('shown', false));
</script>

<style scoped>
.plugin-pane {
    z-index: 5;
    left: 50%;
    bottom: calc(8px + var(--map-bottom-inset, 0px));
    transform: translateX(-50%);
    height: 50px;
    overflow: visible;
    transition: bottom 0.15s ease;
}

@media (max-width: 600px) {
    .plugin-pane {
        /* Above the GPS panel, and above the banner Map.vue reserves room for while it is shown */
        bottom: calc(var(--map-gps-panel-size, 84px) + var(--map-gps-chip-size, 0px) + 16px + var(--map-bottom-inset, 0px));
    }
}
</style>
