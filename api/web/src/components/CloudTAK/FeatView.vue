<template>
    <div
        class='position-absolute end-0 bottom-0 text-white py-2 bg-dark overflow-auto'
        style='z-index: 1; width: 400px; top: 56px;'
    >
        <div
            class='col-12 border-light border-bottom d-flex'
            style='border-radius: 0px;'
        >
            <div class='col-auto card-header row mx-1 my-2'>
                <div
                    class='card-title mx-2'
                    v-text='feat.properties.name || "No Name"'
                />
            </div>
            <div class='col-auto btn-list my-2 ms-auto d-flex align-items-center mx-2'>
                <IconZoomPan
                    v-tooltip='"Zoom To"'
                    size='32'
                    class='cursor-pointer'
                    @click='zoomTo'
                />

                <IconCode
                    v-if='mode === "default"'
                    v-tooltip='"Raw View"'
                    size='32'
                    class='cursor-pointer'
                    @click='mode = "raw"'
                />
                <IconX
                    v-if='mode === "raw"'
                    v-tooltip='"Default View"'
                    size='32'
                    class='cursor-pointer'
                    @click='mode = "default"'
                />
            </div>
        </div>

        <div class='col-12'>
            <template v-if='mode === "default"'>
                <div class='col-12 px-3 py-2'>
                    <Coordinate v-model='center' />
                </div>

                <div class='col-12 px-3 pb-2'>
                    <label class='subheader'>Remarks</label>
                    <div class='table-responsive rounded mx-2 py-2 px-2'>
                        <table class='table card-table table-hover table-vcenter datatable'>
                            <thead>
                                <th>Key</th>
                                <th>Value</th>
                            </thead>
                            <tbody class='bg-gray-500'>
                                <tr
                                    v-for='prop of Object.keys(feat.properties)'
                                    :key='prop'
                                >
                                    <td v-text='prop' />
                                    <td v-text='feat.properties[prop]' />
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>
            <template v-else-if='mode === "raw"'>
                <pre v-text='feat' />
            </template>
        </div>
    </div>
</template>

<script>
import { useMapStore } from '/src/stores/map.ts';
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
    components: {
        IconX,
        IconCode,
        IconZoomPan,
        Coordinate
    },
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
    }
}
</script>
