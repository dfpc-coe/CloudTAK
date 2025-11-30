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

            <div class='mx-2 my-2'>
                <TablerSlidedown
                    :arrow='true'
                    :click-anywhere-expand='true'
                >
                    <div class='d-flex align-items-center w-100'>
                        <span>Style Options</span>
                        <div :style='previewStyle' />
                    </div>
                    <template #expanded>
                        <TablerColour
                            v-model='config.color'
                            label='Color'
                        />
                        <TablerEnum
                            v-model='config.style'
                            label='Style'
                            :options='["solid", "dashed", "dotted", "outlined"]'
                        />
                        <TablerRange
                            v-model='config.width'
                            label='Width'
                            :min='1'
                            :max='10'
                            :step='1'
                        />
                        <TablerRange
                            v-model='config.opacity'
                            label='Opacity'
                            :min='0'
                            :max='1'
                            :step='0.1'
                        />
                    </template>
                </TablerSlidedown>
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
import { ref, toRaw, computed } from 'vue'
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
    TablerColour,
    TablerEnum,
    TablerRange,
    TablerSlidedown
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
    ],
    color: '#d63939',
    style: 'solid',
    width: 3,
    opacity: 1
});

const previewStyle = computed(() => {
    const style = config.value.style === 'outlined' ? 'solid' : config.value.style;

    return {
        width: '100px',
        borderTopWidth: `${config.value.width}px`,
        borderTopStyle: style as 'solid' | 'dashed' | 'dotted',
        borderTopColor: config.value.color,
        opacity: config.value.opacity,
        marginLeft: 'auto',
        marginRight: '1rem'
    };
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
            color: toRaw(config.value.color),
            archived: true,
            'marker-color': toRaw(config.value.color),
            'marker-opacity': toRaw(config.value.opacity),
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
                color: toRaw(config.value.color),
                stroke: toRaw(config.value.color),
                'stroke-width': toRaw(config.value.width),
                'stroke-style': toRaw(config.value.style),
                'stroke-opacity': toRaw(config.value.opacity),
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
