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
                <IconPencil :stroke='1' />
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
                    <IconDeviceFloppy :stroke='1' />
                </TablerIconButton>
                <TablerIconButton
                    color='red'
                    title='Cancel'
                    @click.stop='edit = false; fetch()'
                >
                    <IconX :stroke='1' />
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

<script setup>
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
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

const isOpen = ref(false);
const loading = ref(false);
const edit = ref(false);
const err = ref(null);

const config = ref({
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
        const url = stdurl('/api/config');
        url.searchParams.set('keys', Object.keys(config.value).join(','));
        const res = await std(url);
        for (const key of Object.keys(config.value)) {
             if (res[key] !== undefined) {
                 if (key === 'map::center') {
                     // DB is Lng,Lat. UI is Lat,Lng
                     config.value[key] = res[key].split(',').reverse().join(',');
                 } else {
                     config.value[key] = res[key];
                 }
             }
        }
    } catch (error) {
        err.value = error;
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

        await std(`/api/config`, {
            method: 'PUT',
            body: payload
        });
        edit.value = false;
    } catch (error) {
        err.value = error
        console.error('Failed to save Map config:', error);
    }
    loading.value = false;
}
</script>
