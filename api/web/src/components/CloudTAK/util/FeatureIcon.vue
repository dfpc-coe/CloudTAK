<template>
    <span class='feature-icon position-relative d-inline-flex flex-shrink-0'>
        <canvas
            v-if='supportedIcon'
            ref='imgCanvas'
            :width='props.size'
            :height='props.size'
        />
        <!-- Military symbols render without the map (Event Board) via milsymbol -->
        <img
            v-else-if='standaloneIcon'
            :src='standaloneIcon'
            alt='Feature Icon'
            :width='props.size'
            :height='props.size'
            style='object-fit: contain;'
        >
        <!-- Icons are in order of most preferred display => Least-->
        <IconPointFilled
            v-else-if='feature.properties && feature.properties.type === "u-d-p"'
            :size='props.size'
            :color='feature.properties["marker-color"]'
        />
        <IconPointFilled
            v-else-if='feature.properties && feature.properties.type === "b-m-p-s-m"'
            :size='props.size'
            :color='feature.properties["marker-color"] || "currentColor"'
        />
        <IconCircle
            v-else-if='feature.properties && feature.properties.type === "u-d-c-c"'
            :size='props.size'
            :color='feature.properties.stroke || "currentColor"'
            stroke='1'
        />
        <IconVideo
            v-else-if='feature.properties && feature.properties.type === "b-m-p-s-p-loc"'
            :size='props.size'
            :color='feature.properties.stroke || "currentColor"'
            stroke='1'
        />
        <IconRoute
            v-else-if='feature.properties && feature.properties.type === "b-m-r"'
            :size='props.size'
            :color='feature.properties.stroke || "currentColor"'
            stroke='1'
        />
        <IconLine
            v-else-if='feature.geometry && feature.geometry.type === "LineString"'
            :size='props.size'
            :color='(feature.properties && feature.properties.stroke) || "currentColor"'
            stroke='1'
        />
        <IconCone
            v-else-if='feature.properties && feature.properties.sensor'
            :size='props.size'
            :color='feature.properties.stroke || "currentColor"'
            stroke='1'
        />
        <IconPolygon
            v-else-if='feature.geometry && feature.geometry.type === "Polygon"'
            :size='props.size'
            :color='(feature.properties && feature.properties.fill) || "currentColor"'
            stroke='1'
        />
        <ContactPuck
            v-else-if='feature.properties && feature.properties.group'
            :size='props.size'
            :team='feature.properties.group.name'
        />
        <IconMapPin
            v-else
            :size='props.size'
            stroke='1'
        />

        <span
            v-if='props.error'
            class='feature-icon__error position-absolute d-flex align-items-center justify-content-center rounded-circle'
            :style='{ width: `${errorSize}px`, height: `${errorSize}px` }'
        >
            <IconExclamationMark
                :size='errorSize'
                stroke='3'
            />
        </span>
    </span>
</template>

<script lang='ts'>
export default {
    name: 'FeatureIcon'
};
</script>

<script setup lang='ts'>
import { ref, useTemplateRef, watch, computed } from 'vue';
import ContactPuck from './ContactPuck.vue'
import {
    IconVideo,
    IconCircle,
    IconRoute,
    IconPointFilled,
    IconMapPin,
    IconLine,
    IconCone,
    IconPolygon,
    IconExclamationMark,
} from '@tabler/icons-vue';
import { renderedIconImage } from '../../../base/cot.ts';
import { isMilsymIcon, symbolDataURL } from '../../../utils/milsymbol.ts';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();

const props = defineProps({
    feature: {
        type: Object,
        required: true
    },
    size: {
        type: Number,
        default: 20
    },
    /** Overlay a red exclamation mark on the lower right corner of the icon */
    error: {
        type: Boolean,
        default: false
    }
});

const errorSize = computed<number>(() => Math.max(12, Math.round(props.size * 0.6)));

const canvas = useTemplateRef<HTMLCanvasElement>('imgCanvas');

// Bumped when an on-demand icon resolution completes so supportedIcon re-runs
const resolvedTick = ref(0);
const resolveAttempted = new Set<string>();

// The same image id the map's icon layer requests, so the DOM preview shows
// exactly what the map draws - including the marker-color recolour
const iconImage = computed<string | undefined>(() => {
    return renderedIconImage(props.feature.properties ?? {});
});

const supportedIcon = computed<string | null>(() => {
    void resolvedTick.value;

    const iconId = iconImage.value;
    if (!iconId || !mapStore._map) return null;

    return mapStore.map.getImage(iconId) ? iconId : null;
});

// Pages without a MapLibre instance (Event Board) can't use the map's image
// registry - military symbols are generated directly instead
const standaloneIcon = computed<string | null>(() => {
    const iconId = iconImage.value;
    if (!iconId || mapStore._map || !isMilsymIcon(iconId)) return null;

    return symbolDataURL(iconId);
});

// Military symbols, iconset icons and coloured variants are generated on
// demand - they only exist in the map once a map feature has requested them,
// so trigger resolution here for Features that may not be on screen
watch(iconImage, async (iconId) => {
    if (
        !iconId
        || !mapStore._map
        || supportedIcon.value
        || resolveAttempted.has(iconId)
    ) return;

    resolveAttempted.add(iconId);

    try {
        if (!mapStore.icons.resolvable(iconId)) return;

        await mapStore.icons.resolve(iconId);
        resolvedTick.value += 1;
    } catch {
        // Icon Manager not yet initialized - allow a later icon change to retry
        resolveAttempted.delete(iconId);
    }
}, { immediate: true });

watch([canvas, supportedIcon, () => props.size], async () => {
    if (!canvas.value) return;

    const iconName = supportedIcon.value;
    if (!iconName) return;

    const icon = mapStore.map.getImage(iconName);
    if (!icon) return;

    const context = canvas.value.getContext('2d');

    canvas.value.height = props.size;
    canvas.value.width = props.size;

    if (!context) return;

    const bitmap = await createImageBitmap(new ImageData(
        new Uint8ClampedArray(icon.data.data),
        icon.data.width,
        icon.data.height,
    ));

    if (!canvas.value || supportedIcon.value !== iconName) return;

    context.drawImage(
        bitmap,
        0, 0,
        icon.data.width,
        icon.data.height,
        0,0,
        props.size,props.size
    );
})
</script>

<style scoped>
.feature-icon__error {
    right: -10%;
    bottom: -10%;
    color: #ffffff;
    background-color: #d63939;
    pointer-events: none;
}
</style>
