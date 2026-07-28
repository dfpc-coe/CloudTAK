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
                        <label class='form-label required'>Symbol</label>
                        <template v-if='selectedType'>
                            <div
                                class='d-flex align-items-center gap-2 px-3 form-select'
                                style='cursor: default;'
                            >
                                <span
                                    class='flex-grow-1 user-select-none text-truncate'
                                    v-text='selectedType.name'
                                />
                                <IconX
                                    :size='16'
                                    stroke='1'
                                    class='cursor-pointer flex-shrink-0 text-muted'
                                    @click.stop='selectedType = undefined'
                                />
                            </div>
                        </template>
                        <template v-else>
                            <TablerInput
                                v-model='typeFilter'
                                icon='search'
                                placeholder='Search 2525E Symbols...'
                            />
                            <TablerLoading
                                v-if='typeLoading'
                                :compact='true'
                                desc='Loading Symbols'
                            />
                            <TablerNone
                                v-else-if='!types.length'
                                :compact='true'
                                :create='false'
                                label='No Symbols'
                            />
                            <div
                                v-else
                                class='overflow-auto border rounded'
                                style='max-height: 200px;'
                            >
                                <div
                                    v-for='type in types'
                                    :key='type.sidc'
                                    class='px-2 py-1 cloudtak-hover cursor-pointer user-select-none text-truncate'
                                    @click='selectedType = type'
                                >
                                    {{ type.name }}
                                </div>
                            </div>
                        </template>
                    </div>

                    <div class='col-12'>
                        <Coordinate
                            v-model='config.coordinates'
                            :edit='true'
                            :hover='true'
                        />
                    </div>

                    <div class='col-12'>
                        <TablerInput
                            v-model='config.location'
                            label='Location'
                            placeholder='Human readable location - ie: an address'
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
                    :disabled='!config.name.trim() || !selectedType'
                    @click='submit'
                >
                    Create Event
                </button>
            </template>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import Coordinate from './Coordinate.vue';
import GroupSelect from '../../util/GroupSelect.vue';
import GroupManager from '../../../base/group.ts';
import { useMapStore } from '../../../stores/map.ts';
import { IconX } from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerEnum,
    TablerInput,
    TablerModal,
    TablerLoading,
} from '@tak-ps/vue-tabler';

const emit = defineEmits([ 'close' ]);

const mapStore = useMapStore();

type Symbol2525E = {
    sidc: string;
    name: string;
};

type CoreEventPriority = 'none' | 'low' | 'medium' | 'high' | 'critical';

const error = ref<Error | undefined>(undefined);
const loading = ref(false);

const typeFilter = ref('');
const typeLoading = ref(false);
const types = ref<Symbol2525E[]>([]);
const selectedType = ref<Symbol2525E | undefined>(undefined);

const center = mapStore.map.getCenter();

const config = ref({
    name: '',
    priority: 'none' as CoreEventPriority,
    location: '',
    remarks: '',
    channels: [] as Array<string>,
    coordinates: [
        Math.round(center.lng * 1000000) / 1000000,
        Math.round(center.lat * 1000000) / 1000000,
    ]
});

watch(typeFilter, async () => {
    await fetchTypes();
});

onMounted(async () => {
    await fetchTypes();
});

async function fetchTypes(): Promise<void> {
    try {
        typeLoading.value = true;
        const res = await server.GET('/api/type/2525e', {
            params: {
                query: {
                    filter: typeFilter.value,
                    identity: 'f',
                    limit: 20
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        types.value = res.data.items.map((item) => {
            return { sidc: item.sidc, name: item.name };
        });
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    typeLoading.value = false;
}

async function submit(): Promise<void> {
    if (!selectedType.value) return;

    try {
        loading.value = true;

        const groups = await GroupManager.list();
        const channels = groups
            .filter((group) => config.value.channels.includes(group.name))
            .map((group) => group.bitpos);

        const res = await server.POST('/api/core/event', {
            body: {
                name: config.value.name.trim(),
                type: selectedType.value.sidc,
                priority: config.value.priority,
                location: config.value.location,
                remarks: config.value.remarks,
                external_id: '',
                editable: true,
                channels,
                geometry: {
                    type: 'Point',
                    coordinates: config.value.coordinates
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        emit('close');
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>
