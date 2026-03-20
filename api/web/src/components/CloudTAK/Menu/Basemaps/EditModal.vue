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
                v-if='basemap.id'
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
        <div class='modal-body basemap-modal-body'>
            <TablerLoading v-if='loading' />
            <template v-else-if='showTypeSelector'>
                <BasemapTypeSelector @select='setBasemapType' />
            </template>
            <template v-else-if='mode.upload'>
                <div class='row row-cards'>
                    <div
                        v-if='selectedTypeConfig'
                        class='col-12'
                    >
                        <StandardItem class='d-flex align-items-center gap-3 px-3 py-3'>
                            <div class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 p-2'>
                                <component
                                    :is='selectedTypeConfig.icon'
                                    :size='28'
                                    stroke='1.5'
                                />
                            </div>

                            <div>
                                <div class='fw-semibold'>
                                    {{ selectedTypeConfig.label }}
                                </div>
                                <div class='small text-white-50'>
                                    {{ selectedTypeConfig.description }}
                                </div>
                            </div>

                            <div class='ms-auto'>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-secondary'
                                    @click='resetBasemapType'
                                >
                                    Change Type
                                </button>
                            </div>
                        </StandardItem>
                    </div>

                    <div class='col-12'>
                        <Upload
                            method='PUT'
                            :url='uploadURL()'
                            :headers='uploadHeaders()'
                            @done='processUpload($event)'
                            @cancel='resetBasemapType'
                        />
                    </div>
                </div>
            </template>
            <template v-else-if='mode.tilejson'>
                <div class='row row-cards'>
                    <div
                        v-if='selectedTypeConfig'
                        class='col-12'
                    >
                        <StandardItem class='d-flex align-items-center gap-3 px-3 py-3'>
                            <div class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 p-2'>
                                <component
                                    :is='selectedTypeConfig.icon'
                                    :size='28'
                                    stroke='1.5'
                                />
                            </div>

                            <div>
                                <div class='fw-semibold'>
                                    {{ selectedTypeConfig.label }}
                                </div>
                                <div class='small text-white-50'>
                                    {{ selectedTypeConfig.description }}
                                </div>
                            </div>

                            <div class='ms-auto'>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-secondary'
                                    @click='resetBasemapType'
                                >
                                    Change Type
                                </button>
                            </div>
                        </StandardItem>
                    </div>

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
                                @click='resetBasemapType'
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
                    <div
                        v-if='!basemap.id && selectedTypeConfig'
                        class='col-12'
                    >
                        <StandardItem class='d-flex align-items-center gap-3 px-3 py-3'>
                            <div class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 p-2'>
                                <component
                                    :is='selectedTypeConfig.icon'
                                    :size='28'
                                    stroke='1.5'
                                />
                            </div>

                            <div>
                                <div class='fw-semibold'>
                                    {{ selectedTypeConfig.label }}
                                </div>
                                <div class='small text-white-50'>
                                    {{ selectedTypeConfig.description }}
                                </div>
                            </div>

                            <div class='ms-auto'>
                                <button
                                    type='button'
                                    class='btn btn-sm btn-secondary'
                                    @click='resetBasemapType'
                                >
                                    Change Type
                                </button>
                            </div>
                        </StandardItem>
                    </div>

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
                            :disabled='!!(props.basemap.id && !isSystemAdmin)'
                            :options='["user", "server"]'
                        />
                    </div>
                    <div class='col-md-12'>
                        <TablerInput
                            v-model='editing.url'
                            required
                            :label='urlFieldLabel'
                            :description='urlFieldDescription'
                            :placeholder='urlFieldPlaceholder'
                            :error='errors.url'
                        >
                            <div
                                v-if='urlTokens.length'
                                class='btn-list'
                            >
                                <span
                                    v-for='token in urlTokens'
                                    :key='token.value'
                                    v-tooltip='token.tooltip'
                                    class='badge bg-cyan-lt cursor-pointer'
                                    @click='editing.url = editing.url + token.value'
                                >{{ token.value }}</span>
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
                </div>
            </template>
        </div>

        <div
            v-if='showFormFooter'
            class='modal-footer'
        >
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
    </TablerModal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { std, stdurl } from '../../../../std.ts';
import Upload from '../../../util/Upload.vue';
import StandardItem from '../../util/StandardItem.vue';
import ProfileConfig from '../../../../base/profile.ts';
import type { Basemap, BasemapList } from '../../../../types.ts';
import type { paths } from '../../../../derived-types.js';
import BasemapTypeSelector from './TypeSelector.vue';
import {
    IconBraces,
    IconFileImport,
    IconFileUpload,
    IconGridDots,
    IconMap,
    IconDownload,
    IconPhoto,
    IconVector,
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

type BasemapSourceType = 'zxy' | 'quadkey' | 'imageserver' | 'mapserver' | 'featureserver' | 'tilejson' | 'upload';

const BasemapTypeConfig: Record<BasemapSourceType, {
    label: string;
    description: string;
    icon: object;
    urlLabel: string;
    urlDescription: string;
    urlPlaceholder: string;
    urlTokens: Array<{ value: string; tooltip: string }>;
    defaults: Pick<EditingBasemap, 'type' | 'format' | 'minzoom' | 'maxzoom' | 'tilesize'>;
}> = {
    zxy: {
        label: 'ZXY',
        description: 'Configure a standard XYZ tile template.',
        icon: IconGridDots,
        urlLabel: 'Tile URL Template',
        urlDescription: 'Provide a standard XYZ template using zoom, x, and y variables.',
        urlPlaceholder: 'https://example.com/tiles/{$z}/{$x}/{$y}.png',
        urlTokens: [
            { value: '{$z}', tooltip: 'Insert Zoom Variable' },
            { value: '{$x}', tooltip: 'Insert X Variable' },
            { value: '{$y}', tooltip: 'Insert Y Variable' },
        ],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 16,
            tilesize: 256,
        },
    },
    quadkey: {
        label: 'Quadkey',
        description: 'Configure a quadkey tile template.',
        icon: IconBraces,
        urlLabel: 'Tile URL Template',
        urlDescription: 'Provide a quadkey template using the {$q} variable.',
        urlPlaceholder: 'https://example.com/tiles/{$q}.png',
        urlTokens: [
            { value: '{$q}', tooltip: 'Insert Quadkey Variable' },
        ],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 16,
            tilesize: 256,
        },
    },
    imageserver: {
        label: 'ImageServer',
        description: 'Use an ArcGIS ImageServer service endpoint.',
        icon: IconPhoto,
        urlLabel: 'Service URL',
        urlDescription: 'Provide the ArcGIS ImageServer endpoint for this basemap.',
        urlPlaceholder: 'https://example.com/arcgis/rest/services/WorldImagery/ImageServer',
        urlTokens: [],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 20,
            tilesize: 256,
        },
    },
    mapserver: {
        label: 'MapServer',
        description: 'Use an ArcGIS MapServer layer endpoint.',
        icon: IconMap,
        urlLabel: 'Service URL',
        urlDescription: 'Provide the ArcGIS MapServer layer URL, including the layer id.',
        urlPlaceholder: 'https://example.com/arcgis/rest/services/WorldTopo/MapServer/1',
        urlTokens: [],
        defaults: {
            type: 'vector',
            format: 'mvt',
            minzoom: 0,
            maxzoom: 20,
            tilesize: 256,
        },
    },
    featureserver: {
        label: 'FeatureServer',
        description: 'Use an ArcGIS FeatureServer layer endpoint.',
        icon: IconVector,
        urlLabel: 'Service URL',
        urlDescription: 'Provide the ArcGIS FeatureServer layer URL, including the layer id.',
        urlPlaceholder: 'https://example.com/arcgis/rest/services/Parcels/FeatureServer/1',
        urlTokens: [],
        defaults: {
            type: 'vector',
            format: 'mvt',
            minzoom: 0,
            maxzoom: 20,
            tilesize: 256,
        },
    },
    tilejson: {
        label: 'TileJSON Import',
        description: 'Fetch defaults from a TileJSON URL.',
        icon: IconFileImport,
        urlLabel: 'TileJSON URL',
        urlDescription: 'Provide a TileJSON document URL to prefill the basemap form.',
        urlPlaceholder: 'https://example.com/tilejson.json',
        urlTokens: [],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 16,
            tilesize: 256,
        },
    },
    upload: {
        label: 'TAK XML Upload',
        description: 'Import basemap settings from an existing TAK XML file.',
        icon: IconFileUpload,
        urlLabel: 'Tile Url',
        urlDescription: 'The tile endpoint or service URL for this basemap',
        urlPlaceholder: 'https://example.com/tiles/{$z}/{$x}/{$y}.png',
        urlTokens: [],
        defaults: {
            type: 'raster',
            format: 'png',
            minzoom: 0,
            maxzoom: 16,
            tilesize: 256,
        },
    },
};

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

const selectedBasemapType = ref<BasemapSourceType | null>(
    props.basemap.url ? inferBasemapType(props.basemap.url) : null
);

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

const showTypeSelector = computed(() => {
    return !props.basemap.id && !mode.value.upload && !mode.value.tilejson && !selectedBasemapType.value;
});

const showFormFooter = computed(() => {
    return !loading.value && !showTypeSelector.value && !mode.value.upload && !mode.value.tilejson;
});

const selectedTypeConfig = computed(() => {
    if (!selectedBasemapType.value) return null;
    return BasemapTypeConfig[selectedBasemapType.value];
});

const urlFieldLabel = computed(() => {
    return selectedTypeConfig.value?.urlLabel ?? 'Tile Url';
});

const urlFieldDescription = computed(() => {
    return selectedTypeConfig.value?.urlDescription ?? 'The tile endpoint or service URL for this basemap';
});

const urlFieldPlaceholder = computed(() => {
    return selectedTypeConfig.value?.urlPlaceholder ?? 'https://example.com/tiles/{$z}/{$x}/{$y}.png';
});

const urlTokens = computed(() => {
    return selectedTypeConfig.value?.urlTokens ?? [];
});

onMounted(async () => {
    const isSysAdmin = await ProfileConfig.get('system_admin');
    isSystemAdmin.value = isSysAdmin?.value ?? false;

    if (props.basemap.id) {
        await fetchBasemap();
    }
});

async function download(): Promise<void> {
    await std(`/api/basemap/${props.basemap.id}?format=xml&download=true&token=${localStorage['token']}`, {
        download: true,
    });
}

function inferBasemapType(url?: string | null): BasemapSourceType | null {
    if (!url) return null;
    if (url.includes('{$q}')) return 'quadkey';
    if (url.match(/\/FeatureServer\/\d+$/)) return 'featureserver';
    if (url.match(/\/MapServer\/\d+$/)) return 'mapserver';
    if (url.endsWith('/ImageServer')) return 'imageserver';
    if (url.includes('{$z}') && url.includes('{$x}') && url.includes('{$y}')) return 'zxy';
    return null;
}

function setBasemapType(type: string): void {
    if (type === 'tilejson') {
        selectedBasemapType.value = 'tilejson';
        mode.value.tilejson = true;
        return;
    } else if (type === 'upload') {
        selectedBasemapType.value = 'upload';
        mode.value.upload = true;
        return;
    }

    selectedBasemapType.value = type as BasemapSourceType;
    const config = BasemapTypeConfig[selectedBasemapType.value];
    editing.value.url = '';
    editing.value.type = config.defaults.type;
    editing.value.format = config.defaults.format;
    editing.value.minzoom = config.defaults.minzoom;
    editing.value.maxzoom = config.defaults.maxzoom;
    editing.value.tilesize = config.defaults.tilesize;
}

function resetBasemapType(): void {
    selectedBasemapType.value = null;
    mode.value.upload = false;
    mode.value.tilejson = false;
}

function normalizeEditing(data: Basemap | BasemapImport): EditingBasemap {
    return {
        name: data.name ?? '',
        url: data.url ?? '',
        type: data.type ?? 'raster',
        minzoom: data.minzoom ?? 0,
        maxzoom: data.maxzoom ?? 16,
        tilesize: ('tilesize' in data ? data.tilesize : undefined) ?? 256,
        attribution: ('attribution' in data ? data.attribution : undefined) ?? '',
        sharing_enabled: ('sharing_enabled' in data ? data.sharing_enabled : undefined) ?? true,
        format: data.format ?? 'png',
        bounds: ('bounds' in data && Array.isArray(data.bounds) ? data.bounds : null) ?? [-180, -90, 180, 90],
        center: ('center' in data && Array.isArray(data.center) ? data.center : null) ?? [0, 0],
        collection: ('collection' in data ? data.collection : undefined) ?? '',
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
        selectedBasemapType.value = inferBasemapType(editing.value.url) ?? 'zxy';
        mode.value.tilejson = false;
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

function processUpload(body: unknown): void {
    mode.value.upload = false;
    editing.value = normalizeEditing(body as BasemapImport);
    selectedBasemapType.value = inferBasemapType(editing.value.url) ?? 'zxy';
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
    selectedBasemapType.value = inferBasemapType(editing.value.url);
    loading.value = false;
}

async function create(): Promise<void> {
    errors.value.name = editing.value.name ? '' : 'Cannot be empty';
    errors.value.url = editing.value.url ? '' : 'Cannot be empty';

    if (errors.value.name || errors.value.url) return;

    loading.value = true;
    try {
        const body: Omit<Partial<EditingBasemap>, 'tilesize' | 'collection' | 'attribution' | 'bounds' | 'center'> & {
            bounds?: number[];
            center?: number[];
            tilesize?: number | null;
            collection?: string | null;
            attribution?: string | null;
        } = {
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

<style scoped>
.basemap-modal-body {
    min-height: 34rem;
}
</style>
