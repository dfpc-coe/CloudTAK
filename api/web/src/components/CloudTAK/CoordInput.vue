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
                :modes='["dd"]'
                @submit='submitPoint'
            />
            <Div class='d-flex justify-content-center'>
                <CoordinateType
                    v-model='config.type'
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

<script setup lang='ts'>
import { ref, toRaw } from 'vue'
import Coordinate from './util/Coordinate.vue';
import CoordinateType from './util/CoordinateType.vue';
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
    type: 'u-d-p',
    coordinates: [
        Math.round(center.lng * 1000000) / 1000000,
        Math.round(center.lat * 1000000) / 1000000,
    ]
});

async function submitPoint() {
    const id = crypto.randomUUID();

    await mapStore.worker.db.add({
        id,
        type: 'Feature',
        path: '/',
        properties: {
            id,
            type: toRaw(config.value.type),
            how: 'h-g-i-g-o',
            color: '#00FF00',
            archived: true,
            time: new Date().toISOString(),
            start: new Date().toISOString(),
            stale: new Date().toISOString(),
            center: toRaw(config.value.coordinates),
            callsign: toRaw(config.value.name || 'New Feature'),
            creator: await mapStore.worker.profile.creator()
        },
        geometry: {
            type: 'Point',
            coordinates: toRaw(config.value.coordinates)
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
