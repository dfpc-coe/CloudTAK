<template>
    <FloatingPane
        :uid='uid'
        @close='emit("close")'
    >
        <template #header>
            <IconCompass
                :size='24'
                stroke='1'
                class='ms-2'
            />
            <div
                class='mx-2 text-sm text-truncate'
                v-text='"Range & Bearing"'
            />
        </template>

        <div class='h-100 w-100 overflow-auto'>
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

            <PropertyBearing
                v-model='config.bearing'
                :edit='true'
                :hover='true'
            />

            <PropertyDistance
                v-model='config.range'
                :unit='mapStore.distanceUnit'
                :edit='true'
                :hover='true'
            />

            <div class='mx-2'>
                <button
                    class='btn btn-primary w-100 mt-3'
                    @click='submitPoint'
                >
                    Save
                </button>
            </div>
        </div>
    </FloatingPane>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, toRaw } from 'vue'
import { destination } from '@turf/destination'
import Coordinate from '../util/Coordinate.vue';
import FloatingPane from '../util/FloatingPane.vue';
import PropertyBearing from '../Property/PropertyBearing.vue';
import PropertyDistance from '../Property/PropertyDistance.vue';
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconCompass
} from '@tabler/icons-vue';
import type { LngLatLike } from 'maplibre-gl'
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();

defineProps({
    uid: {
        type: String,
        required: true
    }
});

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
