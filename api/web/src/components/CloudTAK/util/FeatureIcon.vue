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
    <IconCircle
        v-else-if='feature.properties && feature.properties.type === "u-d-c-c"'
        :size='props.size'
        :color='feature.properties.stroke || "white"'
        stroke='1'
    />
    <IconVideo
        v-else-if='feature.properties && feature.properties.type === "b-m-p-s-p-loc"'
        :size='props.size'
        :color='feature.properties.stroke || "white"'
        stroke='1'
    />
    <IconRoute
        v-else-if='feature.properties && feature.properties.type === "b-m-r"'
        :size='props.size'
        :color='feature.properties.stroke || "white"'
        stroke='1'
    />
    <IconLine
        v-else-if='feature.geometry && feature.geometry.type === "LineString"'
        :size='props.size'
        :color='feature.properties.stroke || "white"'
        stroke='1'
    />
    <IconCone
        v-else-if='feature.properties && feature.properties.sensor'
        :size='props.size'
        :color='feature.properties.stroke || "white"'
        stroke='1'
    />
    <IconPolygon
        v-else-if='feature.geometry && feature.geometry.type === "Polygon"'
        :size='props.size'
        :color='feature.properties.fill || "white"'
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
import { useTemplateRef, watch, computed } from 'vue';
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

const supportedIcon = computed<string | null>(() => {
    if (!props.feature.properties.icon) return null;

    if (props.feature.properties.icon.startsWith('COT_MAPPING_2525C')) {
        return props.feature.properties.type;
    } else {
        const icon = mapStore.map.getImage(props.feature.properties.icon)
        if (icon) {
            return props.feature.properties.icon;
        } else {
            return null;
        }
    }
});

watch(canvas, async () => {
    if (!canvas.value) return;

    if (!supportedIcon.value) return;
    const icon = mapStore.map.getImage(supportedIcon.value)
    if (!icon) return;

    const context = canvas.value.getContext('2d');

    canvas.value.height = props.size;
    canvas.value.width = props.size;

    if (!context) return;

    context.drawImage(
        await createImageBitmap(new ImageData(
            // @ts-expect-error icon.data.data issue
            new Uint8ClampedArray(icon.data.data, icon.data.width, icon.data.height),
            icon.data.width,
            icon.data.height,
        )),
        0, 0,
        icon.data.width,
        icon.data.height,
        0,0,
        props.size,props.size
    );
})
</script>
