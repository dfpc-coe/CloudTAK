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
import Coordinate from './util/Coordinate.vue';
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import { useMapStore } from '/src/stores/map.ts';
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();
const mapStore = useMapStore();

export default {
    name: 'CoordInput',
    components: {
        TablerInput,
        Coordinate
    },
    emits: [
        'close'
    ],
    data: function() {
        const center = mapStore.map.getCenter()

        return {
            name: '',
            coordinates: [
                Math.round(center.lng * 1000000) / 1000000,
                Math.round(center.lat * 1000000) / 1000000,
            ]
        };
    },
    methods: {
        submitPoint: async function() {
            await cotStore.add({
                type: 'Feature',
                properties: {
                    type: 'u-d-p',
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

            mapStore.map.flyTo({
                center: this.coordinates,
                zoom: 14
            });

            this.$emit('close');
        },
    }
}
</script>
