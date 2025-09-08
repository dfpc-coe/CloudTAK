<template>
    <div
        class='position-absolute end-0 text-white bg-dark card rounded'
        style='
            top: 56px;
            z-index: 1;
            width: 400px;
            border-radius: 0px 6px 0px 0px;
        '
    >
        <div class='card-header d-flex align-items-center'>
            <div class='card-title'>
                <IconCompass
                    :size='25'
                    stroke='1'
                />

                <span class='ms-2'>Range &amp; Bearing</span>
            </div>
            <div class='ms-auto'>
                <TablerIconButton
                    title='Close'
                    @click='emit("close")'
                >
                    <IconX
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div class='mx-2 my-2 row g-2'>
            <div class='col-12'>
                <TablerInput
                    v-model='config.name'
                    label='Name'
                    @submit='submitPoint'
                />
            </div>
            <div class='col-12'>
                <Coordinate
                    v-model='config.coordinates'
                    :edit='true'
                    :hover='true'
                    :modes='["dd"]'
                    @submit='submitPoint'
                />
            </div>
            <div class='col-12'>
                <PropertyBearing
                    v-model='config.bearing'
                    :edit='true'
                    :hover='true'
                />
            </div>
            <div class='col-12'>
                <PropertyDistance
                    v-model='config.range'
                    :unit='mapStore.distanceUnit'
                    :edit='true'
                    :hover='true'
                />
            </div>
            <div class='col-12'>
                <button
                    class='btn btn-primary w-100 mt-3'
                    @click='submitPoint'
                >
                    Save
                </button>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, toRaw } from 'vue'
import { destination } from '@turf/destination'
import Coordinate from './util/Coordinate.vue';
import PropertyBearing from './util/PropertyBearing.vue';
import PropertyDistance from './util/PropertyDistance.vue';
import {
    TablerInput,
    TablerIconButton
} from '@tak-ps/vue-tabler';

import {
    IconX,
    IconCompass
} from '@tabler/icons-vue';

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
    const id = randomUUID();

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
        },
        geometry: {
            type: 'LineString',
            coordinates: [toRaw(config.value.coordinates), end.geometry.coordinates]
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
