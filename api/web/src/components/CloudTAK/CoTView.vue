<template>
<div class='position-absolute end-0 bottom-0 text-white py-2 bg-dark' style='z-index: 1; width: 400px; top: 50px;'>
    <div class='row g-2'>
        <div class='col-12 row border-light border-bottom'>
            <div class='col-auto row card-header my-2'>
                <div class='card-title mx-2' v-text='cot.properties.callsign'></div>
                <div class='subheader mx-2'>
                    <span class='subheader' v-text='cot.properties.type'/>
                    <span class='subheader ms-auto' v-text='" (" + cot.properties.how || "Unknown" + ")"'/>
                </div>
            </div>
            <div class='col-auto btn-list my-2 ms-auto d-flex align-items-center mx-2'>
                <IconZoomPan @click='zoomTo' class='cursor-pointer' v-tooltip='"Zoom To"'/>

                <IconCode v-if='mode === "default"' @click='mode = "raw"' class='cursor-pointer' v-tooltip='"Raw View"'/>
                <IconX v-if='mode === "raw"' @click='mode = "default"' class='cursor-pointer' v-tooltip='"Default View"'/>
            </div>
        </div>

        <template v-if='mode === "default"'>
            <Coordinate :coordinates='center'/>
            <div v-if='!isNaN(cot.properties.speed)' class='col-12'>
                <Speed :speed='cot.properties.speed'/>
            </div>
            <div v-if='!isNaN(cot.properties.course)' class='col-12'>
                <label class='subheader'>Course</label>
                <div v-text='cot.properties.course' class='bg-gray-500 rounded mx-2 py-2 px-2'/>
            </div>
            <div class='col-12'>
                <label class='subheader'>Remarks</label>
                <div v-text='cot.properties.remarks || "None"' class='bg-gray-500 rounded mx-2 py-2 px-2'/>
            </div>

            <template v-if='isUserDrawn'>
                <CoTStyle v-model='feat'/>
            </template>
        </template>
        <template v-else-if='mode === "raw"'>
            <pre v-text='cot'/>
        </template>
    </div>
</div>
</template>

<script>
import { useMapStore } from '/src/stores/map.js';
const mapStore = useMapStore();
import {
    TablerInput,
    TablerEnum
} from '@tak-ps/vue-tabler';
import pointOnFeature from '@turf/point-on-feature';
import CoTStyle from './util/CoTStyle.vue';
import Coordinate from './util/Coordinate.vue';
import Speed from './util/Speed.vue';
import {
    IconX,
    IconZoomPan,
    IconCode
} from '@tabler/icons-vue';

export default {
    name: 'CloudTAKCoTView',
    props: {
        cot: {
            type: Object,
            required: true
        }
    },
    watch: {
        feat: {
            deep: true,
            handler: function() {
                this.updateStyle();
            }
        }
    },
    data: function() {
        return {
            mode: 'default',
            feat: this.cot,
            icon: null
        }
    },
    mounted: function() {
        if (this.isUserDrawn) {
            if (mapStore.map.getLayer('cots-poly-edit')) mapStore.map.removeLayer('cots-poly-edit');

            mapStore.map.addLayer({
                id: 'cots-poly-edit',
                type: 'fill',
                source: 'cots',
                filter: ['==', ['get', 'id'], this.cot.properties.id],
                paint: {
                    'fill-color': '#000',
                    'fill-opacity': 0.5
                },
            });
        }
    },
    ummounted: function() {
        if (this.isUserDrawn) {
            mapStore.map.removeLayer('cots-poly-edit');
        }
    },
    computed: {
        isUserDrawn: function() {
            return this.cot.properties.type.toLowerCase().startsWith("u-d");
        },
        center: function() {
            return JSON.parse(this.cot.properties.center);
        }
    },
    methods: {
        updateStyle: function() {
            mapStore.map.setPaintProperty('cots-poly-edit', 'fill-color', this.feat.properties.fill);
            mapStore.map.setPaintProperty('cots-poly-edit', 'fill-opacity', this.feat.properties['fill-opacity']);

        },
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
        CoTStyle,
        IconZoomPan,
        Speed,
        Coordinate,
        TablerInput,
        TablerEnum
    }
}
</script>
