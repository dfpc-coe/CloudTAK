<template>
    <FloatingPane
        :uid='uid'
        @close='emit("close")'
    >
        <template #header>
            <IconCursorText
                :size='24'
                stroke='1'
                class='ms-2'
            />
            <div
                class='mx-2 text-sm text-truncate'
                v-text='"Coordinate Entry"'
            />
        </template>

        <div class='mx-2 mb-2'>
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
            @submit='submitPoint'
        />

        <div class='d-flex justify-content-center'>
            <CoordinateType
                v-model='config.type'
                class='pt-3'
                :size='24'
            />
        </div>

        <template #footer>
            <button
                class='btn btn-primary w-100'
                @click='submitPoint'
            >
                Create Point
            </button>
        </template>
    </FloatingPane>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, toRaw } from 'vue'
import Coordinate from '../util/Coordinate.vue';
import CoordinateType from '../util/CoordinateType.vue';
import FloatingPane from '../util/FloatingPane.vue';
import {
    TablerInput,
} from '@tak-ps/vue-tabler';
import {
    IconCursorText,
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
    type: mapStore.defaultPointType,
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
