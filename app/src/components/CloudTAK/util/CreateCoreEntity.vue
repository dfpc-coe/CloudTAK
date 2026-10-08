<template>
    <FloatingPane
        :uid='uid'
        :modal='modal'
        @close='emit("close")'
    >
        <template #header>
            <IconCalendarEvent
                :size='24'
                stroke='1'
                class='ms-2'
            />
            <div
                class='mx-2 text-sm text-truncate'
                v-text='"Create Event"'
            />
        </template>

        <div class='h-100 w-100 overflow-auto'>
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
                        <CoreEntityType v-model='config.type' />
                    </div>

                    <div class='col-12'>
                        <Coordinate
                            v-model='config.coordinates'
                            :edit='true'
                            :hover='true'
                        />
                    </div>

                    <div class='col-12'>
                        <PropertyCoreEntityLocation
                            v-model='config.location'
                            :edit='true'
                        />
                    </div>

                    <div class='col-12'>
                        <label class='form-label'>Remarks</label>
                        <TablerMarkdownEditor
                            v-model='config.remarks'
                            label='Remarks'
                            @submit='submit'
                        />
                    </div>

                    <div class='col-12'>
                        <label class='form-label required'>Share to Channels</label>
                        <div
                            class='overflow-auto'
                            style='max-height: 250px;'
                        >
                            <GroupSelect
                                v-model='config.channels'
                                :active='true'
                            />
                        </div>
                        <div
                            v-if='!config.channels.length'
                            class='form-hint text-warning'
                        >
                            Select at least one Channel to share the Event with
                        </div>
                    </div>
                </div>

                <button
                    class='btn btn-primary w-100 mt-3'
                    :disabled='!valid'
                    @click='submit'
                >
                    Create Event
                </button>
            </template>
        </div>
    </FloatingPane>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { server } from '../../../std.ts';
import Coordinate from './Coordinate.vue';
import FloatingPane from './FloatingPane.vue';
import CoreEntityType from './CoreEntityType.vue';
import PropertyCoreEntityLocation from '../Property/PropertyCoreEntityLocation.vue';
import GroupSelect from '../../util/GroupSelect.vue';
import GroupManager from '../../../base/group.ts';
import { useMapStore } from '../../../stores/map.ts';
import { useFloatStore } from '../../../stores/float.ts';
import type { Pane, PaneCreateEventConfig } from '../../../stores/float.ts';
import type { CoreEntity, InputFeature } from '../../../types.ts';
import { IconCalendarEvent } from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerEnum,
    TablerInput,
    TablerLoading,
    TablerMarkdownEditor,
} from '@tak-ps/vue-tabler';

const props = withDefaults(defineProps<{
    uid?: string;
    modal?: boolean;
    coordinates?: number[];
    location?: string;
    channel?: number;
    navigate?: boolean;
}>(), {
    uid: 'create-event',
    modal: false,
    coordinates: undefined,
    location: undefined,
    channel: undefined,
    navigate: undefined
});

const emit = defineEmits<{
    (e: 'create', event: CoreEntity): void;
    (e: 'close'): void;
}>();

const router = useRouter();
const mapStore = useMapStore();
const floatStore = useFloatStore();

// Opened from the map via the float store (options in the pane config) or mounted
// directly with props from pages without a map
const pane = floatStore.panes.get(props.uid) as Pane<PaneCreateEventConfig> | undefined;
const opts = {
    coordinates: props.coordinates ?? pane?.config.coordinates,
    location: props.location ?? pane?.config.location,
    channel: props.channel ?? pane?.config.channel,
    navigate: props.navigate ?? pane?.config.navigate ?? true,
};

type CoreEntityPriority = 'none' | 'low' | 'medium' | 'high' | 'critical';

const error = ref<Error | undefined>(undefined);
const loading = ref(false);

// The form is also used from pages without a map (Event Board) so the map
// can only be consulted for a default center when it actually exists
const center = opts.coordinates && opts.coordinates.length >= 2
    ? { lng: opts.coordinates[0], lat: opts.coordinates[1] }
    : mapStore._map
        ? mapStore.map.getCenter()
        : { lng: 0, lat: 0 };

const config = ref({
    name: '',
    type: '',
    priority: 'none' as CoreEntityPriority,
    location: opts.location || '',
    remarks: '',
    channels: [] as Array<string>,
    coordinates: [
        Math.round(center.lng * 1000000) / 1000000,
        Math.round(center.lat * 1000000) / 1000000,
    ]
});

const valid = computed(() => {
    return !!config.value.name.trim() && !!config.value.type && config.value.channels.length > 0;
});

onMounted(async () => {
    if (opts.channel === undefined) return;

    try {
        const groups = await GroupManager.list();
        const match = groups.find((group) => group.bitpos === opts.channel);
        if (match) config.value.channels = [match.name];
    } catch (err) {
        console.error('Failed to preselect Channel:', err);
    }
});

async function submit(): Promise<void> {
    if (!valid.value) return;

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
                editable: true,
                metadata: {},
                links: [],
                missions: [],
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

        emit('create', res.data as CoreEntity);
        emit('close');

        if (opts.navigate) {
            void router.push(`/event/${res.data.id}`);
        }
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>
