<template>
    <canvas
        v-if='supportedIcon'
        ref='imgCanvas'
        :width='props.size'
        :height='props.size'
    />
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
        :color='feature.properties.stroke || "currentColor"'
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
        :color='feature.properties.fill || "currentColor"'
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
</template>

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
} from '@tabler/icons-vue';
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
    }
});

const canvas = useTemplateRef<HTMLCanvasElement>('imgCanvas');

// Bumped when an on-demand icon resolution completes so supportedIcon re-runs
const resolvedTick = ref(0);
const resolveAttempted = new Set<string>();

const supportedIcon = computed<string | null>(() => {
    void resolvedTick.value;

    const iconId = props.feature.properties.icon;
    if (!iconId) return null;

    return mapStore.map.getImage(iconId) ? iconId : null;
});

// Military symbols are generated on demand - they only exist in the map
// once a map feature has requested them, so trigger resolution here
watch(() => props.feature.properties.icon, async (iconId) => {
    if (
        !iconId
        || supportedIcon.value
        || !/^2525[CDE]:/.test(iconId)
        || resolveAttempted.has(iconId)
    ) return;

    resolveAttempted.add(iconId);

    try {
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
