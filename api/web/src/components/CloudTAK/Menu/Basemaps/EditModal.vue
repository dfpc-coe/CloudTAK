<template>
    <TablerModal>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />

        <div class='modal-header user-select-none'>
            <IconMap
                :size='32'
                stroke='1'
                class='me-2'
            />
            <div
                v-if='basemap.id'
                class='strong d-flex align-items-center'
                v-text='basemap.name'
            />
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
                    <TablerInlineAlert
                        v-if='warnSharing'
                        severity='danger'
                        title='You are disabling sharing'
                        description='Disabling sharing will prevent other users from sharing the basemap and will also disable their access if they basemap has already been shared'
                        :dismissable='true'
                    />

                    <div class='col-12 col-lg-6 mt-3'>
                        <TablerInput
                            v-model='editing.name'
                            required
                            label='Name'
                            :error='errors.name'
                        >
                            <TablerToggle
                                v-model='editing.sharing_enabled'
                                label='Enable Sharing'
                                @change='editing.sharing_enabled ? warnSharing = false : warnSharing = true'
                            />
                        </TablerInput>
                    </div>
                    <div class='col-12 col-lg-3 mt-3'>
                        <TablerEnum
                            v-model='editing.type'
                            required
                            label='Type'
                            :options='["raster", "raster-dem", "vector"]'
                        />
                    </div>
                    <div class='col-12 col-lg-3 mt-3'>
                        <TablerEnum
                            v-model='scope'
                            required
                            label='Access Scope'
                            :disabled='(props.basemap.id && !isSystemAdmin)'
                            :options='["user", "server"]'
                        />
                    </div>
                    <div class='col-md-12'>
                        <TablerInput
                            v-model='editing.url'
                            required
                            label='Tile Url'
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
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='editing.minzoom'
                            required
                            label='MinZoom'
                        />
                    </div>
                    <div class='col-md-3'>
                        <TablerInput
                            v-model='editing.maxzoom'
                            required
                            label='MaxZoom'
                        />
                    </div>
                    <div class='col-12 col-md-3'>
                        <TablerInput
                            v-model='editing.tilesize'
                            label='Tile Size'
                        />
                    </div>
                    <div class='col-12 col-md-3'>
                        <TablerEnum
                            v-model='editing.format'
                            required
                            label='Format'
                            :options='["png", "jpeg", "mvt"]'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerInput
                            v-model='editing.collection'
                            label='Collection Folder'
                            placeholder='Optional Collection Folder'
                        />
                    </div>
                    <div class='col-12'>
                        <TablerInput
                            v-model='editing.attribution'
                            label='Attribution'
                            placeholder='Optional Attribution'
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

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { std, stdurl } from '../../../../std.ts';
import Upload from '../../../util/Upload.vue';
import ProfileConfig from '../../../../base/profile.ts';
import type { Basemap, BasemapList } from '../../../../types.ts';
import type { paths } from '../../../../derived-types.js';
import {
    IconMap,
    IconDownload,
    IconFileImport,
    IconFileUpload
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerDelete,
    TablerLoading,
    TablerInlineAlert,
    TablerIconButton,
    TablerToggle,
    TablerEnum,
    TablerInput
} from '@tak-ps/vue-tabler';

type BasemapImport = paths['/api/basemap']['put']['responses']['200']['content']['application/json'];

interface EditingBasemap {
    name: string;
    url: string;
    type: 'raster' | 'raster-dem' | 'vector';
    minzoom: number;
    maxzoom: number;
    tilesize: number;
    attribution: string;
    sharing_enabled: boolean;
    format: 'png' | 'jpeg' | 'mvt';
    bounds: number[];
    center: number[];
    collection: string;
}

const emit = defineEmits(['close']);

const props = withDefaults(defineProps<{
    basemap?: Partial<BasemapList['items'][0]>;
}>(), {
    basemap: () => ({})
});

const warnSharing = ref(false);
const loading = ref(false);

const mode = ref({
    upload: false,
    tilejson: false,
});

const tilejson = ref({ url: '' });

const errors = ref<Record<'name' | 'url', string>>({
    name: '',
    url: '',
});

const scope = ref<'user' | 'server'>(
    props.basemap.id ? (props.basemap.username ? 'user' : 'server') : 'user'
);

const isSystemAdmin = ref(false);

const editing = ref<EditingBasemap>({
    name: '',
    url: '',
    type: 'raster',
    minzoom: 0,
    maxzoom: 16,
    tilesize: 256,
    attribution: '',
    sharing_enabled: true,
    format: 'png',
    bounds: [-180, -90, 180, 90],
    center: [0, 0],
    collection: '',
});

onMounted(async () => {
    const isSysAdmin = await ProfileConfig.get('system_admin');
    isSystemAdmin.value = isSysAdmin?.value ?? false;

    if (props.basemap.id) {
        await fetchBasemap();
    }
});

async function download(): Promise<void> {
    await std(`api/basemap/${props.basemap.id}?format=xml&download=true&token=${localStorage['token']}`, {
        download: true,
    });
}

function normalizeEditing(data: Basemap | BasemapImport): EditingBasemap {
    return {
        name: data.name ?? '',
        url: data.url ?? '',
        type: data.type ?? 'raster',
        minzoom: data.minzoom ?? 0,
        maxzoom: data.maxzoom ?? 16,
        tilesize: ('tilesize' in data ? data.tilesize : undefined) ?? 256,
        attribution: (('attribution' in data ? data.attribution : undefined) ?? '') ?? '',
        sharing_enabled: ('sharing_enabled' in data ? data.sharing_enabled : undefined) ?? true,
        format: data.format ?? 'png',
        bounds: ('bounds' in data && Array.isArray(data.bounds) ? data.bounds : null) ?? [-180, -90, 180, 90],
        center: ('center' in data && Array.isArray(data.center) ? data.center : null) ?? [0, 0],
        collection: (('collection' in data ? data.collection : undefined) ?? '') ?? '',
    };
}

async function fetchTileJSON(): Promise<void> {
    loading.value = true;
    try {
        const data = await std('/api/basemap', {
            method: 'PUT',
            headers: { 'Content-Type': 'text/plain' },
            body: tilejson.value.url,
        }) as BasemapImport;
        editing.value = normalizeEditing(data);
        mode.value.tilejson = false;
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

function processUpload(body: BasemapImport): void {
    mode.value.upload = false;
    editing.value = normalizeEditing(body);
}

function uploadHeaders(): Record<string, string> {
    return {
        Authorization: `Bearer ${localStorage['token']}`,
    };
}

function uploadURL(): URL {
    return stdurl('/api/basemap');
}

async function fetchBasemap(): Promise<void> {
    loading.value = true;
    const data = await std(`/api/basemap/${props.basemap.id}`) as Basemap;
    editing.value = normalizeEditing(data);
    loading.value = false;
}

async function create(): Promise<void> {
    errors.value.name = editing.value.name ? '' : 'Cannot be empty';
    errors.value.url = editing.value.url ? '' : 'Cannot be empty';

    if (errors.value.name || errors.value.url) return;

    loading.value = true;
    try {
        const body: Partial<EditingBasemap> & { bounds?: number[]; center?: number[]; tilesize?: number | null; collection?: string | null; attribution?: string | null; } = {
            ...editing.value,
        };

        if (!body.bounds?.length) delete body.bounds;
        if (!body.center?.length) delete body.center;

        if (!body.tilesize && body.tilesize !== 0) body.tilesize = null;

        if (!body.collection || body.collection.trim().length === 0) body.collection = null;

        if (!body.attribution || body.attribution.trim().length === 0) body.attribution = null;

        if (props.basemap.id) {
            await std(`/api/basemap/${props.basemap.id}`, {
                method: 'PATCH',
                body: { scope: scope.value, ...body },
            });
        } else {
            await std('/api/basemap', {
                method: 'POST',
                body: { scope: scope.value, ...body },
            });
        }

        loading.value = false;
        emit('close');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteBasemap(): Promise<void> {
    loading.value = true;
    try {
        await std(`/api/basemap/${props.basemap.id}`, { method: 'DELETE' });
        emit('close');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
