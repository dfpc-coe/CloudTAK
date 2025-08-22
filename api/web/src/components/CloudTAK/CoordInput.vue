<template>
    <TablerModal size='md'>
        <div class='modal-status bg-blue' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-white'>
            <div class='modal-title'>
                Coordinate Entry
            </div>
        </div>
        <div class='modal-body text-white'>
            <div class='mx-2 my-2'>
                <TablerInput
                    v-model='config.name'
                    label='Name'
                    @submit='submitPoint'
                />
            </div>

            <Coordinate
                v-model='config.coordinates'
                :edit='true'
                :hover='true'
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
    </TablerModal>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, toRaw } from 'vue'
import Coordinate from './util/Coordinate.vue';
import CoordinateType from './util/CoordinateType.vue';
import {
    TablerInput,
    TablerModal,
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
    const id = randomUUID();

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
        },
        geometry: {
            type: 'Point',
            coordinates: toRaw(config.value.coordinates)
        }
    }, {
        authored: true
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
