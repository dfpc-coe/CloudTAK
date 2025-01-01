<template>
    <div 
        class='position-absolute bottom-0 text-white bg-dark px-2 py-2 rounded-top'
        style='
            z-index: 1;
            left: calc(50% - 120px);
            width: 300px;
        '
    >
        <div v-if='mapStore.drawOptions.mode === "point"'>
            <CoordinateType
                v-model='mapStore.drawOptions.pointMode'
            />
        </div>
        <div v-else-if='mapStore.drawOptions.mode === "angled-rectangle"'>
            <IconVector :size='24' stroke='1'/><span class='mx-2'>Rectangle Editing</span>
        </div>
        <div v-else-if='mapStore.drawOptions.mode === "linestring"'>
            <IconLine :size='24' stroke='1'/><span class='mx-2'>Line Editing</span>
        </div>
        <div v-else-if='mapStore.drawOptions.mode === "polygon"'>
            <IconPolygon :size='24' stroke='1'/><span class='mx-2'>Polygon Editing</span>
        </div>
        <div v-else-if='mapStore.drawOptions.mode === "sector"'>
            <IconCone :size='24' stroke='1'/><span class='mx-2'>Sector Editing</span>
        </div>
        <div v-else-if='mapStore.drawOptions.mode === "freehand"'>
            <IconLasso :size='24' stroke='1'/><span class='mx-2'>Lasso Select</span>
        </div>
        <div v-else>
            Unknown Editing
        </div>
    </div>
</template>

<script setup lang='ts'>
import CoordinateType from '../util/CoordinateType.vue';
import { useMapStore } from '../../../stores/map.ts';
import {
    IconLine,
    IconLasso,
    IconCone,
    IconVector,
    IconPolygon,
} from '@tabler/icons-vue';

const mapStore = useMapStore();
</script>
