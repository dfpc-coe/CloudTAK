<template>
    <div class='col-lg-12 hover py-2 d-flex align-items-center' :class="{ 'cursor-pointer': !edit }">
        <div class="d-flex align-items-center flex-grow-1" @click="isOpen = !isOpen">
            <IconChevronDown v-if="isOpen" />
            <IconChevronRight v-else />
            <span class='mx-2 user-select-none'>Map Settings</span>
        </div>
        <div class='ms-auto' v-if="!edit && isOpen">
             <TablerIconButton title="Edit" @click="edit = true">
                <IconPencil />
             </TablerIconButton>
        </div>
    </div>

    <div v-if="isOpen" class='col-lg-12 py-2 border rounded'>
        <TablerLoading v-if="loading" />
        <template v-else>
            <div class="row">
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
            </div>
             <div class='col-lg-12 d-flex py-2' v-if="edit">
                <div class='btn' @click='fetch'>Cancel</div>
                <div class='ms-auto'>
                    <div class='btn btn-primary' @click='save'>Save Settings</div>
                </div>
            </div>
        </template>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { std, stdurl } from '../../../std.ts';
import { validateLatLng } from '../../../base/validators.ts';
import {
    TablerLoading,
    TablerInput,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconChevronRight,
    IconChevronDown,
    IconPencil
} from '@tabler/icons-vue';

const isOpen = ref(false);
const loading = ref(false);
const edit = ref(false);

const config = ref({
    'map::center': '40,-100', // Default Lat,Lng
    'map::zoom': 4,
    'map::bearing': 0,
    'map::pitch': 0,
});

onMounted(() => {
     if (isOpen.value) fetch();
});

watch(isOpen, (newState) => {
    if (newState && !edit.value) fetch();
});

async function fetch() {
    loading.value = true;
    edit.value = false;
    try {
        const url = stdurl('/api/config');
        url.searchParams.append('keys', Object.keys(config.value).join(','));
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
        console.error('Failed to load Map config:', error);
    }
    loading.value = false;
}

async function save() {
    loading.value = true;
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
        console.error('Failed to save Map config:', error);
    }
    loading.value = false;
}
</script>
