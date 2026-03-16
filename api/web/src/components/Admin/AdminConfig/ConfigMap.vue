<template>
    <SlideDownHeader
        v-model='isOpen'
        label='Map Settings'
    >
        <template #right>
            <TablerIconButton
                v-if='!edit && isOpen'
                title='Edit'
                @click.stop='edit = true'
            >
                <IconPencil stroke='1' />
            </TablerIconButton>
            <div
                v-else-if='edit && isOpen'
                class='d-flex gap-1'
            >
                <TablerIconButton
                    color='blue'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy color='white' stroke='1' />
                </TablerIconButton>
                <TablerIconButton
                    color='red'
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX stroke='1' />
                </TablerIconButton>
            </div>
        </template>
        <div class='col-lg-12 py-2 px-2 border rounded'>
            <TablerLoading v-if='loading' />
            <template v-else>
                <TablerAlert
                    v-if='err'
                    :err='err'
                />
                <div class='row'>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config[`map::center`]'
                            label='Initial Map Center (<lat>,<lng>)'
                            placeholder='Latitude, Longitude'
                            :error='validateLatLng(config[`map::center`])'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config[`map::zoom`]'
                            label='Initial Map Zoom'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config[`map::pitch`]'
                            label='Initial Map Pitch'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-12'>
                        <TablerInput
                            v-model='config[`map::bearing`]'
                            label='Initial Map Bearing'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-12 mt-3'>
                        <label class='form-label'>Default Basemap</label>
                        <BasemapSelect
                            v-model='config[`map::basemap`]'
                            :disabled='!edit'
                        />
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import { validateLatLng } from '../../../base/validators.ts';
import BasemapSelect from '../../util/BasemapSelect.vue';
import {
    TablerLoading,
    TablerInput,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX
} from '@tabler/icons-vue';

const isOpen = ref<boolean>(false);
const loading = ref<boolean>(false);
const edit = ref<boolean>(false);
const err = ref<Error | null>(null);

const config = ref<{
    'map::center': string;
    'map::zoom': number;
    'map::bearing': number;
    'map::pitch': number;
    'map::basemap': number | null;
}>({
    'map::center': '40,-100', // Default Lat,Lng
    'map::zoom': 4,
    'map::bearing': 0,
    'map::pitch': 0,
    'map::basemap': null
});

onMounted(() => {
     if (isOpen.value) fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) fetch();
});

async function fetch() {
    loading.value = true;
    err.value = null;
    try {
        const res = await server.GET('/api/config', {
            params: {
                query: {
                    keys: Object.keys(config.value).join(',')
                }
            }
        });
        if (res.error) throw new Error(res.error.message);

        config.value = {
            // DB is Lng,Lat. UI is Lat,Lng
            'map::center': res.data['map::center']
                ? String(res.data['map::center']).split(',').reverse().join(',')
                : config.value['map::center'],
            'map::zoom': res.data['map::zoom'] ?? config.value['map::zoom'],
            'map::bearing': res.data['map::bearing'] ?? config.value['map::bearing'],
            'map::pitch': res.data['map::pitch'] ?? config.value['map::pitch'],
            'map::basemap': res.data['map::basemap'] ?? config.value['map::basemap'],
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }
    loading.value = false;
}

async function save() {
    loading.value = true;
    err.value = null;
    try {
        const payload = { ...config.value };
        // Save as Lng,Lat
        payload['map::center'] = payload['map::center'].split(',').reverse().join(',');

        const res = await server.PUT('/api/config', {
            body: payload
        });
        if (res.error) throw new Error(res.error.message);
        edit.value = false;
    } catch (error) {
        err.value = error as Error;
        console.error('Failed to save Map config:', error);
    }
    loading.value = false;
}
</script>
