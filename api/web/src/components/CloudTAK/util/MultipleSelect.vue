<template>
    <div
        ref='selectMenu'
        class='cloudtak-panel p-2'
        style='
            width: 200px;
        '
    >
        <div
            v-for='feat in mapStore.select.feats'
            :key='feat.properties.id || feat.id'
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
import { ref, onMounted, onUnmounted, watch, markRaw } from 'vue';
import Feature from './FeatureRow.vue'
import { useMapStore } from '../../../stores/map.ts';
import * as mapgl from 'maplibre-gl';

const emit = defineEmits([ 'selected' ]);

const mapStore = useMapStore();
const selectMenu = ref<HTMLElement | null>(null);

onMounted(() => {
    if (!selectMenu.value) return;

    if (!mapStore.select.popup) {
        // @ts-expect-error mapgl.Popup causes deep UnwrapRef instantiation in Pinia reactive stores
        mapStore.select.popup = markRaw(new mapgl.Popup({
            closeButton: false,
            closeOnClick: false,
            maxWidth: 'none',
            className: 'multiple-select-popup'
        }));

        mapStore.select.popup.on('close', () => {
            if (mapStore.select.feats.length) {
                mapStore.select.feats = [];
            }
        });
    }

    const lngLat = mapStore.map.unproject([mapStore.select.x, mapStore.select.y]);

    mapStore.select.popup
        .setLngLat(lngLat)
        .setDOMContent(selectMenu.value)
        .addTo(mapStore.map);
});

watch(() => [mapStore.select.x, mapStore.select.y], ([x, y]) => {
    if (mapStore.select.popup) {
        const lngLat = mapStore.map.unproject([x, y]);
        mapStore.select.popup.setLngLat(lngLat);
    }
});

onUnmounted(() => {
    if (mapStore.select.popup) {
        mapStore.select.popup.remove();
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

/* Tip color mirrors the .cloudtak-panel background; the tip is a sibling of
 * the popup content, so the panel's own --cloudtak-panel-bg is out of scope here. */
html[data-bs-theme='dark'] .multiple-select-popup {
    --multiple-select-tip: rgba(20, 20, 25, 0.96);
}

html[data-bs-theme='light'] .multiple-select-popup {
    --multiple-select-tip: rgba(255, 255, 255, 0.96);
}

.multiple-select-popup.maplibregl-popup-anchor-top .maplibregl-popup-tip {
    border-bottom-color: var(--multiple-select-tip);
}

.multiple-select-popup.maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
    border-top-color: var(--multiple-select-tip);
}

.multiple-select-popup.maplibregl-popup-anchor-left .maplibregl-popup-tip {
    border-right-color: var(--multiple-select-tip);
}

.multiple-select-popup.maplibregl-popup-anchor-right .maplibregl-popup-tip {
    border-left-color: var(--multiple-select-tip);
}
</style>
