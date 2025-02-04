<template>
    <TablerModal>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />

        <div class='modal-header'>
            <div
                v-if='basemap.id'
                class='strong d-flex align-items-center'
            >
                Basemap <span v-text='basemap.name' />
            </div>
            <div
                v-else
                class='strong align-items-center'
            >
                New Basemap
            </div>

            <div
                v-if='!loading && !mode.upload && !mode.tilejson && !basemap.id'
                class='ms-auto btn-list'
            >
                <TablerIconButton
                    title='XML Upload'
                    @click='mode.upload = true'
                >
                    <IconFileUpload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='TileJSON Import'
                    @click='mode.tilejson = true'
                >
                    <IconFileImport
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
            <div
                v-else-if='basemap.id'
                class='ms-auto btn-list'
            >
                <TablerIconButton
                    title='Download TAK XML'
                    @click='download'
                >
                    <IconDownload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div class='modal-body'>
            <TablerLoading v-if='loading' />
            <template v-else-if='mode.upload'>
                <Upload
                    method='PUT'
                    :url='uploadURL()'
                    :headers='uploadHeaders()'
                    @done='processUpload($event)'
                    @cancel='mode.upload = false'
                    @err='err = $event'
                />
            </template>
            <template v-else-if='mode.tilejson'>
                <div class='row row-cards'>
                    <div class='col-md-12 mt-3'>
                        <TablerInput
                            v-model='tilejson.url'
                            label='TileJSON URL'
                        />
                    </div>
                    <div class='col-md-12 mt-3'>
                        <div class='d-flex'>
                            <button
                                class='cursor-pointer btn btn-secondary'
                                @click='mode.tilejson = false'
                            >
                                Cancel
                            </button>
                            <div class='ms-auto'>
                                <a
                                    class='cursor-pointer btn btn-primary'
                                    @click='fetchTileJSON'
                                >Fetch TileJSON</a>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else>
                <div class='row row-cards'>
                    <div class='col-12 col-md-6 mt-3'>
                        <TablerInput
                            v-model='editing.name'
                            label='Basemap Name'
                            :error='errors.name'
                        />
                    </div>
                    <div class='col-12 col-md-3 mt-3'>
                        <TablerEnum
                            v-model='editing.type'
                            label='Basemap Type'
                            :options='["raster", "raster-dem", "vector"]'
                        />
                    </div>
                    <div class='col-12 col-md-3 mt-3'>
                        <TablerEnum
                            v-model='scope'
                            label='Basemap Scope'
                            :disabled='(props.basemap.id && !profileStore.profile.system_admin)'
                            :options='["user", "server"]'
                        />
                    </div>
                    <div class='col-md-12'>
                        <TablerInput
                            v-model='editing.url'
                            label='Basemap Url'
                            :error='errors.url'
                        >
                            <div class='btn-list'>
                                <span
                                    v-tooltip='"Insert Zoom Variable"'
                                    class='badge bg-cyan-lt cursor-pointer'
                                    @click='editing.url = editing.url + "{$z}"'
                                >{$z}</span>
                                <span
                                    v-tooltip='"Insert X Variable"'
                                    class='badge bg-cyan-lt cursor-pointer'
                                    @click='editing.url = editing.url + "{$x}"'
                                >{$x}</span>
                                <span
                                    v-tooltip='"Insert Y Variable"'
                                    class='badge bg-cyan-lt cursor-pointer'
                                    @click='editing.url = editing.url + "{$y}"'
                                >{$y}</span>
                                <span
                                    v-tooltip='"Insert Quadkey Variable"'
                                    class='badge bg-cyan-lt cursor-pointer'
                                    @click='editing.url = editing.url + "{$q}"'
                                >{$q}</span>
                            </div>
                        </TablerInput>
                    </div>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='editing.minzoom'
                            label='Basemap MinZoom'
                        />
                    </div>
                    <div class='col-md-4'>
                        <TablerInput
                            v-model='editing.maxzoom'
                            label='Basemap MaxZoom'
                        />
                    </div>
                    <div class='col-12 col-md-4'>
                        <TablerEnum
                            v-model='editing.format'
                            label='Basemap Format'
                            :options='["png", "jpeg", "mvt"]'
                        />
                    </div>
                    <div class='col-md-12 mt-3'>
                        <div class='d-flex'>
                            <div v-if='basemap.id'>
                                <TablerDelete
                                    label='Delete Basemap'
                                    @delete='deleteBasemap'
                                />
                            </div>

                            <div class='ms-auto'>
                                <a
                                    class='cursor-pointer btn btn-primary'
                                    @click='create'
                                >Save Basemap</a>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { std, stdurl } from '/src/std.ts';
import Upload from '../../../util/Upload.vue';
import {
    IconDownload,
    IconFileImport,
    IconFileUpload
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerEnum,
    TablerInput
} from '@tak-ps/vue-tabler';
import { useProfileStore } from '/src/stores/profile.ts';

const emit = defineEmits(['close']);

const props = defineProps({
    basemap: {
        type: Object
    }
});

const profileStore = useProfileStore();

const loading = ref(false);

const mode = ref({
    upload: false,
    tilejson: false,
});

const tilejson = ref({
    url: ''
})

const errors = ref({
    name: '',
    url: '',
});

const scope = ref(props.basemap.id ? (props.basemap.username ? 'user' : 'server') : 'user')

const editing = ref({
    name: '',
    url: '',
    type: 'raster',
    minzoom: 0,
    maxzoom: 16,
    format: 'png',
    bounds: [-180, -90, 180, 90 ],
    center: [0, 0]
})

onMounted(async () => {
    if (props.basemap.id) {
        await fetch();
    }
});

function download() {
    window.location.href = stdurl(`api/basemap/${props.basemap.id}?format=xml&download=true&token=${localStorage.token}`);
}

async function fetchTileJSON() {
    loading.value = true;
    try {
        editing.value = await std('/api/basemap', {
            method: 'PUT',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: tilejson.value.url
        });
        mode.value.tilejson = false;
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

function processUpload(body) {
    mode.value.upload = false;
    editing.value = JSON.parse(body);
}

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

function uploadURL() {
    return stdurl(`/api/basemap`);
}

async function fetch() {
    loading.value = true;
    editing.value = await std(`/api/basemap/${props.basemap.id}`);
    loading.value = false;
}

async function create() {
    for (const field of ['name', 'url' ]) {
        if (!editing.value[field]) errors.value[field] = 'Cannot be empty';
        else errors.value[field] = '';
    }

    for (const e in errors.value) {
        if (errors.value[e]) return;
    }

    loading.value = true;
    try {
        if (props.basemap.id) {
            const body = JSON.parse(JSON.stringify(editing.value));

            if (!body.bounds || !body.bounds.length) delete body.bounds;
            if (!body.center || !body.center.length) delete body.center;

            await std(`/api/basemap/${props.basemap.id}`, {
                method: 'PATCH',
                body: {
                    scope: scope.value,
                    ...body
                }
            });
            emit('close');
        } else {
            await std('/api/basemap', {
                method: 'POST',
                body: {
                    scope: scope.value,
                    ...editing.value
                }
            });
            emit('close');
        }
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteBasemap() {
    loading.value = true;
    try {
        await std(`/api/basemap/${props.basemap.id}`, {
            method: 'DELETE'
        });
        emit('close');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
