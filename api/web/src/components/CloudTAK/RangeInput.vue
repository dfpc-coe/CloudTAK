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
                v-model='config.name'
                label='Name'
                @submit='submitPoint'
            />
            <Coordinate
                v-model='config.coordinates'
                :edit='true'
                :hover='true'
                :modes='["dd"]'
                @submit='submitPoint'
            />

            <PropertyBearing
                v-model='config.bearing'
                :edit='true'
                :hover='true'
            />

            <PropertyDistance
                v-model='config.range'
                :edit='true'
                :hover='true'
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

<script setup lang='ts'>
import { ref, toRaw } from 'vue'
import { destination } from '@turf/destination'
import Coordinate from './util/Coordinate.vue';
import PropertyBearing from './util/PropertyBearing.vue';
import PropertyDistance from './util/PropertyDistance.vue';
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import type { LngLatLike } from 'maplibre-gl'
import { useMapStore } from '../../stores/map.ts';
const mapStore = useMapStore();

const emit = defineEmits([ 'close' ]);

const center = mapStore.map.getCenter();

const config = ref({
    name: '',
    range: 1,
    bearing: 0,
    coordinates: [
        Math.round(center.lng * 1000000) / 1000000,
        Math.round(center.lat * 1000000) / 1000000,
    ]
});

async function submitPoint() {
    const id = crypto.randomUUID();

    const end = destination(
        config.value.coordinates,
        config.value.range,
        config.value.bearing
    )

    await mapStore.worker.db.add({
        id,
        type: 'Feature',
        path: '/',
        properties: {
            id,
            type: 'u-rb-a',
            how: 'h-g-i-g-o',
            color: '#00FF00',
            archived: true,
            time: new Date().toISOString(),
            start: new Date().toISOString(),
            stale: new Date().toISOString(),
            center: toRaw(config.value.coordinates),
            bearing: config.value.bearing,
            range: config.value.range,
            callsign: toRaw(config.value.name || 'New Feature'),
            creator: await mapStore.worker.profile.creator()
        },
        geometry: {
            type: 'LineString',
            coordinates: [toRaw(config.value.coordinates), end.geometry.coordinates]
        }
    });

    if (mapStore.map) {
        mapStore.map.flyTo({
            center: config.value.coordinates as LngLatLike,
            zoom: 14
        });
    }

    emit('close');
}
</script>
