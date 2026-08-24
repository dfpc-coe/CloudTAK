<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-body'>
            <div class='modal-title'>
                Create Event
            </div>
        </div>
        <div class='modal-body text-body'>
            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading
                v-else-if='loading'
                desc='Creating Event'
            />
            <template v-else>
                <div class='row g-2'>
                    <div class='col-12 col-md-8'>
                        <TablerInput
                            v-model='config.name'
                            label='Name'
                            :required='true'
                        />
                    </div>
                    <div class='col-12 col-md-4'>
                        <TablerEnum
                            v-model='config.priority'
                            label='Priority'
                            :options='["none", "low", "medium", "high", "critical"]'
                        />
                    </div>

                    <div class='col-12'>
                        <CoreEventType v-model='config.type' />
                    </div>

                    <div class='col-12'>
                        <Coordinate
                            v-model='config.coordinates'
                            :edit='true'
                            :hover='true'
                        />
                    </div>

                    <div class='col-12'>
                        <PropertyCoreEventLocation
                            v-model='config.location'
                            :edit='true'
                        />
                    </div>

                    <div class='col-12'>
                        <TablerInput
                            v-model='config.remarks'
                            label='Remarks'
                            :rows='3'
                        />
                    </div>

                    <div class='col-12'>
                        <label class='form-label'>Share to Channels</label>
                        <div
                            class='overflow-auto'
                            style='max-height: 250px;'
                        >
                            <GroupSelect
                                v-model='config.channels'
                                :active='true'
                            />
                        </div>
                    </div>
                </div>

                <button
                    class='btn btn-primary w-100 mt-3'
                    :disabled='!config.name.trim() || !config.type'
                    @click='submit'
                >
                    Create Event
                </button>
            </template>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { server } from '../../../std.ts';
import Coordinate from './Coordinate.vue';
import CoreEventType from './CoreEventType.vue';
import PropertyCoreEventLocation from '../Property/PropertyCoreEventLocation.vue';
import GroupSelect from '../../util/GroupSelect.vue';
import GroupManager from '../../../base/group.ts';
import { useMapStore } from '../../../stores/map.ts';
import type { CoreEvent, InputFeature } from '../../../types.ts';
import {
    TablerAlert,
    TablerEnum,
    TablerInput,
    TablerModal,
    TablerLoading,
} from '@tak-ps/vue-tabler';

const props = withDefaults(defineProps<{
    coordinates?: number[];
    location?: string;
    channel?: number;
    navigate?: boolean;
}>(), {
    coordinates: undefined,
    location: undefined,
    channel: undefined,
    navigate: true
});

const emit = defineEmits<{
    (e: 'create', event: CoreEvent): void;
    (e: 'close'): void;
}>();

const router = useRouter();
const mapStore = useMapStore();

type CoreEventPriority = 'none' | 'low' | 'medium' | 'high' | 'critical';

const error = ref<Error | undefined>(undefined);
const loading = ref(false);

// The modal is also used from pages without a map (Event Board) so the map
// can only be consulted for a default center when it actually exists
const center = props.coordinates && props.coordinates.length >= 2
    ? { lng: props.coordinates[0], lat: props.coordinates[1] }
    : mapStore._map
        ? mapStore.map.getCenter()
        : { lng: 0, lat: 0 };

const config = ref({
    name: '',
    type: '',
    priority: 'none' as CoreEventPriority,
    location: props.location || '',
    remarks: '',
    channels: [] as Array<string>,
    coordinates: [
        Math.round(center.lng * 1000000) / 1000000,
        Math.round(center.lat * 1000000) / 1000000,
    ]
});

onMounted(async () => {
    if (props.channel === undefined) return;

    try {
        const groups = await GroupManager.list();
        const match = groups.find((group) => group.bitpos === props.channel);
        if (match) config.value.channels = [match.name];
    } catch (err) {
        console.error('Failed to preselect Channel:', err);
    }
});

async function submit(): Promise<void> {
    if (!config.value.type) return;

    try {
        loading.value = true;

        const groups = await GroupManager.list();
        const channels = groups
            .filter((group) => config.value.channels.includes(group.name))
            .map((group) => group.bitpos);

        const res = await server.POST('/api/core/event', {
            body: {
                name: config.value.name.trim(),
                type: config.value.type,
                priority: config.value.priority,
                location: config.value.location,
                remarks: config.value.remarks,
                external_id: '',
                editable: true,
                metadata: {},
                links: [],
                style: {},
                channels,
                geometry: {
                    type: 'Point',
                    coordinates: config.value.coordinates
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        // Provisional marker so the Event appears immediately - the CoT
        // broadcast replaces it under the same UID, or it goes stale
        if (mapStore._worker) {
            try {
                await mapStore.worker.db.add({
                    id: res.data.id,
                    type: 'Feature',
                    properties: {
                        ...res.data.style,
                        type: res.data.type,
                        how: 'm-g',
                        callsign: res.data.name,
                        remarks: res.data.remarks,
                        stale: new Date(Date.now() + 30 * 1000).toISOString(),
                        links: [{
                            relation: 'p',
                            type: 'core-event',
                            event: res.data.id,
                            remarks: res.data.name,
                        }],
                    },
                    geometry: res.data.geometry,
                } as InputFeature);
            } catch (err) {
                console.error('Failed to place provisional Event marker:', err);
            }
        }

        emit('create', res.data as CoreEvent);
        emit('close');

        if (props.navigate) {
            void router.push(`/event/${res.data.id}`);
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>
