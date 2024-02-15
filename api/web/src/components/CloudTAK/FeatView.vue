<template>
<div
    class='position-absolute end-0 bottom-0 text-white py-2 bg-dark'
    style='z-index: 1; width: 400px; top: 56px;'
>
    <div class='col-12 border-light border-bottom d-flex'>
        <div class='col-auto card-header row mx-1 my-2'>
            <div class='card-title mx-2' v-text='feat.properties.name'></div>
        </div>
        <div class='col-auto btn-list my-2 ms-auto d-flex align-items-center mx-2'>
            <IconZoomPan @click='zoomTo' class='cursor-pointer' v-tooltip='"Zoom To"'/>

            <IconCode v-if='mode === "default"' @click='mode = "raw"' class='cursor-pointer' v-tooltip='"Raw View"'/>
            <IconX v-if='mode === "raw"' @click='mode = "default"' class='cursor-pointer' v-tooltip='"Default View"'/>
        </div>
    </div>

    <div class='col-12'>
        <template v-if='mode === "default"'>
            <Coordinate :coordinates='center'/>
        </template>
        <template v-else-if='mode === "raw"'>
            <pre v-text='feat'/>
        </template>
    </div>
</div>
</template>

<script>
import { useMapStore } from '/src/stores/map.js';
import pointOnFeature from '@turf/point-on-feature';
import Coordinate from './util/Coordinate.vue';
const mapStore = useMapStore();
import {
    IconX,
    IconZoomPan,
    IconCode
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKFeatView',
    props: {
        feat: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            mode: 'default',
            icon: null
        }
    },
    computed: {
        center: function() {
            return pointOnFeature(this.feat).geometry.coordinates;
        }
    },
    methods: {
        zoomTo: function() {
            mapStore.map.flyTo({
                center: this.center,
                zoom: 14
            })
        }
    },
    components: {
        IconX,
        IconCode,
        IconZoomPan,
        Coordinate
    }
}
</script>
