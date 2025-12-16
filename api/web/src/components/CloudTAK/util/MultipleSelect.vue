<template>
    <div
        ref='selectMenu'
        class='bg-dark rounded p-2'
        style='
            width: 200px;
        '
    >
        <div
            v-for='feat in mapStore.select.feats'
            :key='feat.properties.id'
            role='menuitem'
            tabindex='0'
            class='col-12 text-white'
            @click='emit("selected", feat)'
        >
            <Feature
                :feature='feat'
                :compact='true'
                :delete-button='false'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import Feature from './FeatureRow.vue'
import { useMapStore } from '../../../stores/map.ts';
import mapgl from 'maplibre-gl';

const emit = defineEmits([ 'selected' ]);

const mapStore = useMapStore();
const selectMenu = ref<HTMLElement | null>(null);
let popup: mapgl.Popup | undefined;

onMounted(() => {
    if (!selectMenu.value) return;

    const lngLat = mapStore.map.unproject([mapStore.select.x, mapStore.select.y]);

    popup = new mapgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: 'none',
        className: 'multiple-select-popup'
    })
        .setLngLat(lngLat)
        .setDOMContent(selectMenu.value)
        .addTo(mapStore.map);

    popup.on('close', () => {
        if (mapStore.select.feats) {
            mapStore.select.feats = [];
            popup.remove();
        }
    });
});

watch(() => [mapStore.select.x, mapStore.select.y], ([x, y]) => {
    if (popup) {
        const lngLat = mapStore.map.unproject([x, y]);
        popup.setLngLat(lngLat);
    }
});

onUnmounted(() => {
    if (popup) {
        popup.remove();
    }
});
</script>

<style>
.multiple-select-popup {
    pointer-events: none;
}

.multiple-select-popup .maplibregl-popup-content {
    background: transparent;
    padding: 0;
    pointer-events: auto;
}

.multiple-select-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip {
    border-bottom-color: #1f2937;
}

.multiple-select-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
    border-top-color: #1f2937;
}

.multiple-select-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip {
    border-right-color: #1f2937;
}

.multiple-select-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip {
    border-left-color: #1f2937;
}
</style>
