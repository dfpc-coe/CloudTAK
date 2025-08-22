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
            <div class='modal-title d-flex align-items-center'>
                <IconWalk
                    :size='32'
                    stroke='1'
                />
                <span class='mx-2'>Lost Person Behavior Input</span>
            </div>
        </div>
        <div class='modal-body text-white'>
            <div class='mx-2 my-2'>
                <TablerInput
                    v-model='config.name'
                    label='Name'
                    @submit='submitRings'
                />
            </div>

            <Coordinate
                v-model='config.coordinates'
                label='Origin'
                :edit='true'
                :hover='true'
                :modes='["dd"]'
                @submit='submitRings'
            />

            <PropertyDistance
                v-model='config.rings["25%"]'
                label='25% Containment Radius'
                :edit='true'
                :hover='true'
            />

            <PropertyDistance
                v-model='config.rings["50%"]'
                label='50% Containment Radius'
                :edit='true'
                :hover='true'
            />

            <PropertyDistance
                v-model='config.rings["75%"]'
                label='75% Containment Radius'
                :edit='true'
                :hover='true'
            />

            <button
                class='btn btn-primary w-100 mt-3'
                @click='submitRings'
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
import PropertyDistance from './util/PropertyDistance.vue';
import Ellipse from '@turf/ellipse'
import {
    IconWalk,
} from '@tabler/icons-vue';
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
    rings: {
        '25%': 0,
        '50%': 0,
        '75%': 0
    },
    coordinates: [
        Math.round(center.lng * 1000000) / 1000000,
        Math.round(center.lat * 1000000) / 1000000,
    ]
});

async function submitRings() {
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
            callsign: toRaw((config.value.name || '') + " Origin"),
        },
        geometry: {
            type: 'Point',
            coordinates: toRaw(config.value.coordinates)
        }
    }, {
        authored: true
    });

    const keys = Object.keys(config.value.rings) as (keyof typeof config.value.rings)[];
    for (const ring of keys) {
        if (config.value.rings[ring] === 0) continue;

        const ringid = randomUUID();

        await mapStore.worker.db.add({
            id: ringid,
            type: 'Feature',
            path: '/',
            properties: {
                id: ringid,
                type: 'u-d-c-c',
                how: 'h-g-i-g-o',
                color: '#00FF00',
                archived: true,
                shape: {
                    ellipse: {
                        major: config.value.rings[ring] * 1000,
                        minor: config.value.rings[ring] * 1000,
                        angle: 360
                    }
                },
                'fill-opacity': 0,
                time: new Date().toISOString(),
                start: new Date().toISOString(),
                stale: new Date().toISOString(),
                center: toRaw(config.value.coordinates),
                callsign: toRaw((config.value.name || '') + " " + ring),
            },
            geometry: Ellipse(
                config.value.coordinates,
                config.value.rings[ring],
                config.value.rings[ring],
                {
                    angle: 360
                }
            ).geometry
        }, {
            authored: true
        });
    }

    if (mapStore.map) {
        mapStore.map.flyTo({
            center: config.value.coordinates as LngLatLike,
            zoom: 14
        });
    }

    emit('close');
}
</script>
