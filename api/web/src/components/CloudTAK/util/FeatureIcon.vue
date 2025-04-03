<template>
    <div
        style='`
            height: ${props.size}px;
            width: ${props.size}px;
        `'
    >
        <canvas
            v-if='feature.properties.icon'
            ref='imgCanvas'
            :width='props.size'
            :height='props.size'
        />
        <IconPointFilled
            v-else-if='feature.properties && feature.properties.type === "u-d-p"'
            :size='props.size'
            :color='feature.properties["marker-color"]'
        />
        <!-- Icons are in order of most preferred display => Least-->
        <IconVideo
            v-else-if='feature.properties && feature.properties.type === "b-m-p-s-p-loc"'
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
        <IconMapPin
            v-else
            :size='props.size'
            stroke='1'
        />
    </div>
</template>

<script setup lang='ts'>
import { useTemplateRef, watch } from 'vue';
import {
    IconVideo,
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
        required: true,
        default: 20
    }
});

const canvas = useTemplateRef<HTMLCanvasElement>('imgCanvas');

watch(canvas, async () => {
    if (!canvas.value) return;

    const icon = mapStore.map.getImage(props.feature.properties.icon)

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
