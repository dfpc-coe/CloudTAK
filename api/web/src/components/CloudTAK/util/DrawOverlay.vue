<template>
<div 
    class='position-absolute bottom-0 text-white bg-dark px-2 py-2'
    style='
    z-index: 1;
    left: calc(50% - 120px);
    width: 380px;
'
>
    <div v-if='mapStore.drawOptions.mode === "point"'>
        <CoordinateType
            v-model='mapStore.drawOptions.pointMode'
        />
    </div>
    <div v-else-if='mapStore.drawOptions.mode === "angled-rectangle"'>
        Rectangle Editing
    </div>
    <div v-else-if='mapStore.drawOptions.mode === "linestring"'>
        Line Editing
    </div>
    <div v-else-if='mapStore.drawOptions.mode === "polygon"'>
        Polygon Editing
    </div>
    <div v-else-if='mapStore.drawOptions.mode === "sector"'>
        Sector Editing
    </div>
    <div v-else-if='mapStore.drawOptions.mode === "freehand"'>
        Freehand Editing
    </div>
    <div v-else>
        Unknown Editing
    </div>
</div>
</template>

<script setup lang='ts'>
import CoordinateType from '../util/CoordinateType.vue';
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();
</script>
