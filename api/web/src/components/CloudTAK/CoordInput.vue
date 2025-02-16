<template>
    <div
        class='position-absolute end-0 text-white bg-dark'
        style='
        top: 56px;
        z-index: 1;
        width: 400px;
        border-radius: 0px 6px 0px 0px;
    '
    >
        <div class='mx-2 my-2'>
            <TablerInput
                v-model='name'
                label='Name'
                @submit='submitPoint'
            />
            <Coordinate
                v-model='coordinates'
                :edit='true'
                :modes='["dd"]'
                @submit='submitPoint'
            />
            <Div class='d-flex justify-content-center'>
                <CoordinateType
                    v-model='type'
                    class='pt-3'
                    :size='24'
                />
            </div>
            <button
                class='btn btn-primary w-100 mt-3'
                @click='submitPoint'
            >
                Save
            </button>
        </div>
    </div>
</template>

<script>
import { defineComponent } from 'vue'
import Coordinate from './util/Coordinate.vue';
import CoordinateType from './util/CoordinateType.vue';
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import { useMapStore } from '../../stores/map.ts';
import { useMapWorkerStore } from '../../stores/worker.ts';
const mapWorkerStore = useMapWorkerStore();
const mapStore = useMapStore();

export default defineComponent({
    name: 'CoordInput',
    components: {
        TablerInput,
        CoordinateType,
        Coordinate
    },
    emits: [
        'close'
    ],
    data: function() {
        const center = mapStore.map ? mapStore.map.getCenter() : [0,0]

        return {
            name: '',
            type: 'u-d-p',
            coordinates: [
                Math.round(center.lng * 1000000) / 1000000,
                Math.round(center.lat * 1000000) / 1000000,
            ]
        };
    },
    methods: {
        submitPoint: async function() {
            await mapWorkerStore.worker.add({
                type: 'Feature',
                properties: {
                    type: this.type,
                    how: 'h-g-i-g-o',
                    color: '#00FF00',
                    archived: true,
                    callsign: this.name || 'New Feature'
                },
                geometry: {
                    type: 'Point',
                    coordinates: this.coordinates
                }
            });

            if (mapStore.map) {
                mapStore.map.flyTo({
                    center: this.coordinates,
                    zoom: 14
                });
            }

            this.$emit('close');
        },
    }
})
</script>
