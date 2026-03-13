<template>
    <TablerModal>
        <div class='modal-header'>
            <div class='modal-title'>
                Buffer Geometry
            </div>
            <button
                type='button'
                class='btn-close'
                aria-label='Close'
                @click='emit("close")'
            />
        </div>
        <div class='modal-body'>
            <div class='mb-3'>
                <label class='form-label'>Radius</label>
                <div class='input-group'>
                    <input
                        v-model.number='radius'
                        type='number'
                        class='form-control'
                        min='1'
                    >
                    <select
                        v-model='unit'
                        class='form-select'
                    >
                        <option value='meters'>
                            meters
                        </option>
                        <option value='kilometers'>
                            kilometers
                        </option>
                        <option value='miles'>
                            miles
                        </option>
                    </select>
                </div>
            </div>
        </div>
        <div class='modal-footer'>
            <button
                type='button'
                class='btn'
                @click='emit("close")'
            >
                Cancel
            </button>
            <button
                type='button'
                class='btn btn-primary'
                @click='applyBuffer'
            >
                Apply
            </button>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { v4 as randomUUID } from 'uuid';
import turfBuffer from '@turf/buffer';
import { TablerModal } from '@tak-ps/vue-tabler';
import { useMapStore } from '../../../stores/map.ts';
import type { Feature } from '../../../types.ts';

const props = defineProps<{
    cotId: string;
}>();

const emit = defineEmits<{
    close: []
}>();

const mapStore = useMapStore();

const radius = ref(100);
const unit = ref<'meters' | 'kilometers' | 'miles'>('meters');

async function applyBuffer(): Promise<void> {
    if (radius.value <= 0) return;

    const cotFeat = await mapStore.worker.db.get(props.cotId, { mission: true });
    if (!cotFeat) throw new Error('Cannot find COT to buffer');

    const geom = cotFeat.geometry;
    if (geom.type === 'GeometryCollection') throw new Error('Cannot buffer a GeometryCollection');

    const buffered = turfBuffer(geom, radius.value, { units: unit.value });
    if (!buffered) throw new Error('Buffer operation produced no result');

    const now = new Date();
    const id = randomUUID();

    const ring = buffered.geometry.type === 'Polygon'
        ? buffered.geometry.coordinates[0] as [number, number][]
        : buffered.geometry.coordinates[0][0] as [number, number][];
    const centerLng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
    const centerLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;

    const feat: Feature = {
        id,
        type: 'Feature',
        path: cotFeat.path || '/',
        properties: {
            ...cotFeat.properties,
            id,
            callsign: `${cotFeat.properties.callsign} (Buffer)`,
            type: 'u-d-f',
            center: [centerLng, centerLat],
            time: now.toISOString(),
            start: now.toISOString(),
        },
        geometry: buffered.geometry
    };

    await mapStore.worker.db.add(feat, { authored: true });
    await mapStore.refresh();

    emit('close');
}
</script>
