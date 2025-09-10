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
                <IconTarget
                    :size='32'
                    stroke='1'
                />
                <span class='mx-2'>Range Rings</span>
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

            <div class='mx-2 border my-2'>
                <template v-for='ring of config.rings'>
                    <div class='position-relative'>
                        <div
                            v-if='config.rings.length > 1'
                            class='position-absolute cursor-pointer'
                            style='
                                top: 4px;
                                right: 4px;
                            '
                            @click='config.rings.splice(config.rings.indexOf(ring), 1)'
                        >
                            <IconTrash
                                :size='18'
                                stroke='1'
                            />
                        </div>

                        <PropertyDistance
                            v-model='ring.distance'
                            class='py-2'
                            label='Ring Diameter'
                            :edit='true'
                            :hover='true'
                        />
                    </div>
                </template>

                <div class='col-12 px-2 py-2'>
                    <button
                        class='btn btn-secondary btn-sm w-100'
                        @click='config.rings.push({ distance: 1 })'
                    >
                        <IconPlus
                            :size='18'
                            stroke='1'
                        />
                        <span class='ms-2'>Add Ring</span>
                    </button>
                </div>
            </div>

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
    IconPlus,
    IconTarget,
    IconTrash
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
    rings: [{
        distance: 1
    }],
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

    for (let i = 0; i < config.value.rings.length; i++) {
        const ring = config.value.rings[i];

        if (ring.distance === 0) continue;

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
                        major: ring.distance * 1000,
                        minor: ring.distance * 1000,
                        angle: 360
                    }
                },
                'fill-opacity': 0,
                time: new Date().toISOString(),
                start: new Date().toISOString(),
                stale: new Date().toISOString(),
                center: toRaw(config.value.coordinates),
                callsign: toRaw((config.value.name || '') + " Ring #" + (i + 1)),
            },
            geometry: Ellipse(
                config.value.coordinates,
                ring.distance,
                ring.distance,
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
