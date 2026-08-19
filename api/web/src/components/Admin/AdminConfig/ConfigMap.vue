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
                    color='rgba(var(--tblr-primary-rgb), 0.14)'
                    title='Save'
                    @click.stop='save'
                >
                    <IconDeviceFloppy
                        color='rgb(var(--tblr-primary-rgb))'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
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
                    <div class='col-lg-12 mt-3'>
                        <label class='form-label'>Default Terrain</label>
                        <BasemapSelect
                            v-model='config[`map::terrain`]'
                            type='raster-dem'
                            no-value-label='No Default Terrain'
                            :disabled='!edit'
                        />
                    </div>
                    <div class='col-lg-12 mt-3'>
                        <label class='form-label'>Favourite Basemaps</label>

                        <TablerNone
                            v-if='!favs.length'
                            :compact='true'
                            :create='false'
                            label='No Favourite Basemaps'
                        />

                        <div class='d-flex flex-column gap-2'>
                            <template
                                v-for='(fav, i) in favs'
                                :key='i'
                            >
                                <StandardItem
                                    v-if='!edit'
                                    class='d-flex align-items-center'
                                >
                                    <div class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 ms-2 my-2 overflow-hidden'>
                                        <img
                                            v-if='fav.image'
                                            :src='fav.image'
                                            :alt='fav.name'
                                            class='fav-preview'
                                        >
                                        <IconPhoto
                                            v-else
                                            :size='24'
                                            stroke='1'
                                        />
                                    </div>

                                    <div class='ms-3 flex-grow-1 fav-content'>
                                        <span class='fw-semibold'>{{ fav.name }}</span>
                                    </div>
                                </StandardItem>

                                <StandardItem
                                    v-else
                                    class='px-3 py-2'
                                >
                                    <div class='d-flex align-items-center mb-2'>
                                        <div class='fw-semibold'>
                                            Favourite {{ i + 1 }}
                                        </div>
                                        <div class='ms-auto'>
                                            <TablerIconButton
                                                title='Remove Favourite'
                                                @click='favs.splice(i, 1)'
                                            >
                                                <IconTrash
                                                    :size='20'
                                                    stroke='1'
                                                />
                                            </TablerIconButton>
                                        </div>
                                    </div>

                                    <BasemapSelect
                                        v-model='fav.id'
                                        :disabled='!edit'
                                    />

                                    <TablerUploadLogo
                                        v-model='fav.image'
                                        :input-id='`basemap-fav-image-${i}`'
                                        label='Preview Image (PNG)'
                                        :disabled='!edit'
                                    />
                                </StandardItem>
                            </template>

                            <button
                                v-if='edit && favs.length < 3'
                                class='btn btn-secondary w-100'
                                @click='favs.push({ id: null, name: "", image: "" })'
                            >
                                <IconPlus
                                    :size='20'
                                    stroke='1'
                                />
                                <span class='mx-2'>Add Favourite</span>
                            </button>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </SlideDownHeader>
</template>

<script setup lang="ts">
import SlideDownHeader from '../../CloudTAK/util/SlideDownHeader.vue';
import StandardItem from '../../CloudTAK/util/StandardItem.vue';
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import { validateLatLng } from '../../../utils/validators.ts';
import BasemapSelect from '../../util/BasemapSelect.vue';
import {
    TablerLoading,
    TablerInput,
    TablerIconButton,
    TablerAlert,
    TablerNone,
    TablerUploadLogo
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconPhoto,
    IconPlus,
    IconTrash,
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
    'map::terrain': number | null;
}>({
    'map::center': '40,-100', // Default Lat,Lng
    'map::zoom': 4,
    'map::bearing': 0,
    'map::pitch': 0,
    'map::basemap': null,
    'map::terrain': null
});

type BasemapFavDraft = {
    id: number | null;
    name: string;
    image: string;
};

const favs = ref<Array<BasemapFavDraft>>([]);

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
                    keys: [...Object.keys(config.value), 'map::basemap::favs'].join(',')
                }
            }
        });
        if (res.error) throw new Error(res.error.message);

        favs.value = (res.data['map::basemap::favs'] ?? []).map((fav) => ({ ...fav }));

        config.value = {
            // DB is Lng,Lat. UI is Lat,Lng
            'map::center': typeof res.data['map::center'] === 'string'
                ? String(res.data['map::center']).split(',').reverse().join(',')
                : config.value['map::center'],
            'map::zoom': res.data['map::zoom'] ?? config.value['map::zoom'],
            'map::bearing': res.data['map::bearing'] ?? config.value['map::bearing'],
            'map::pitch': res.data['map::pitch'] ?? config.value['map::pitch'],
            'map::basemap': res.data['map::basemap'] ?? config.value['map::basemap'],
            'map::terrain': res.data['map::terrain'] ?? config.value['map::terrain'],
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

        const favsPayload: Array<{ id: number; name: string; image: string }> = [];
        for (const fav of favs.value) {
            if (fav.id === null) {
                throw new Error('Each Favourite Basemap must have a Basemap selected');
            } else if (!fav.image) {
                throw new Error('Each Favourite Basemap must have a Preview Image');
            } else if (favsPayload.some((existing) => existing.id === fav.id)) {
                throw new Error('Favourite Basemaps must be unique');
            }

            const basemapRes = await server.GET('/api/basemap/{:basemapid}', {
                params: { path: { ':basemapid': fav.id } }
            });

            if (basemapRes.error) throw new Error(basemapRes.error.message);
            if (typeof basemapRes.data === 'string' || !basemapRes.data) throw new Error('Unexpected Basemap Response');

            favsPayload.push({
                id: fav.id,
                name: basemapRes.data.name,
                image: fav.image
            });
        }

        const res = await server.PUT('/api/config', {
            body: {
                ...payload,
                'map::basemap::favs': favsPayload.length ? favsPayload : null
            }
        });
        if (res.error) throw new Error(res.error.message);

        favs.value = favsPayload.map((fav) => ({ ...fav }));

        edit.value = false;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Map config:', error);
    }
    loading.value = false;
}
</script>

<style scoped>
.fav-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.fav-content {
    min-width: 0;
}
</style>
