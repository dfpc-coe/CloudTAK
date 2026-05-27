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
            <div class='d-flex flex-column'>
                <div class='strong d-flex align-items-center'>
                    Basemaps &amp; Overlays
                </div>
                <div
                    v-if='basemap.id'
                    class='small text-white-50'
                    v-text='basemap.name'
                />
                <div
                    v-else
                    class='small text-white-50'
                >
                    New Entry
                </div>
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
            <BasemapTypeSelector
                v-else-if='showTypeSelector'
                :is-system-admin='isSystemAdmin'
                @select='setBasemapType'
            />
            <component
                :is='activeSelectorComponent'
                v-else-if='activeSelectorComponent'
                v-model:editing='editing'
                :basemap-id='props.basemap.id'
                :vector-layers='vectorLayers'
                :errors='errors'
                :scope='scope'
                :warn-sharing='warnSharing'
                :is-system-admin='isSystemAdmin'
                :url='tilejson.url'
                :upload-url='uploadUrl'
                @change-type='resetBasemapType'
                @update:scope='scope = $event'
                @update:warn-sharing='warnSharing = $event'
                @update:url='tilejson.url = $event'
                @fetch='fetchTileJSON'
                @done='processUpload($event)'
            />
        </div>

        <div
            v-if='showFormFooter'
            class='modal-footer'
        >
            <div v-if='basemap.id'>
                <TablerDelete
                    label='Delete Basemap / Overlay'
                    @delete='deleteBasemap'
                />
            </div>

            <div class='ms-auto'>
                <a
                    class='cursor-pointer btn btn-primary'
                    @click='create'
                >Save Basemap / Overlay</a>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Preferences } from '@capacitor/preferences';
import type { paths } from '@cloudtak/api-types';
import { server, std, stdurl } from '../../../../std.ts';
import ProfileConfig from '../../../../base/profile.ts';
import BasemapTypeSelector from './TypeSelector.vue';
import TypeSelectorFeatureServer from './TypeSelectorFeatureServer.vue';
import TypeSelectorImageServer from './TypeSelectorImageServer.vue';
import TypeSelectorMapServer from './TypeSelectorMapServer.vue';
import TypeSelectorZxy_Tilejson from './TypeSelectorZxy_Tilejson.vue';
import TypeSelectorZxy_Upload from './TypeSelectorZxy_Upload.vue';
import TypeSelectorZxy from './TypeSelectorZxy.vue';
import TypeSelectorHosted from './TypeSelectorHosted.vue';
import { BasemapTypeConfig, inferBasemapType, normalizeEditing } from './types.ts';
import type { BasemapListItem, BasemapImport, BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from './types.ts';
import {
    IconMap,
    IconDownload,
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const emit = defineEmits(['close']);

const props = withDefaults(defineProps<{
    basemap?: BasemapListItem;
}>(), {
    basemap: () => ({})
});

const warnSharing = ref(false);
const loading = ref(false);

const selectedBasemapType = ref<BasemapSourceType | null>(
    props.basemap.url ? (inferBasemapType(props.basemap.url) ?? 'zxy') : null
);

const tilejson = ref({ url: '' });
const vectorLayers = ref<VectorLayerDescriptor[]>([]);

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
    title: 'callsign',
    overlay: false,
    hidden: false,
    frequency: null,
    snapping_enabled: false,
    snapping_layer: '',
    styles: [],
    tilejson: '',
    encoding: null,
});

const showTypeSelector = computed(() => {
    return !props.basemap.id && !selectedBasemapType.value;
});

const metadataImportTypes: BasemapSourceType[] = ['imageserver', 'mapserver', 'featureserver'];

const showMetadataImportPrompt = computed(() => {
    return !props.basemap.id
        && !!selectedBasemapType.value
        && metadataImportTypes.includes(selectedBasemapType.value)
        && !editing.value.url;
});

const showFormFooter = computed(() => {
    return !loading.value
        && !showTypeSelector.value
        && !showMetadataImportPrompt.value
        && !!selectedBasemapType.value
        && selectedBasemapType.value !== 'upload'
        && selectedBasemapType.value !== 'tilejson'
        && selectedBasemapType.value !== 'hosted';
});

const activeSelectorComponent = computed(() => {
    switch (selectedBasemapType.value) {
    case 'zxy': return TypeSelectorZxy;
    case 'imageserver': return TypeSelectorImageServer;
    case 'mapserver': return TypeSelectorMapServer;
    case 'featureserver': return TypeSelectorFeatureServer;
    case 'tilejson': return TypeSelectorZxy_Tilejson;
    case 'upload': return TypeSelectorZxy_Upload;
    case 'hosted': return TypeSelectorHosted;
    default: return null;
    }
});

const uploadUrl = computed(() => stdurl('/api/basemap'));

type BasemapImportBody = paths['/api/basemap']['put']['requestBody']['content']['application/json'];
type BasemapCreateBody = paths['/api/basemap']['post']['requestBody']['content']['application/json'];
type BasemapUpdateBody = paths['/api/basemap/{:basemapid}']['patch']['requestBody']['content']['application/json'];

onMounted(async () => {
    const isSysAdmin = await ProfileConfig.get('system_admin');
    isSystemAdmin.value = isSysAdmin?.value ?? false;

    if (props.basemap.id) {
        await fetchBasemap();
    }
});

async function download(): Promise<void> {
    const url = stdurl(`/api/basemap/${props.basemap.id}`);
    const { value: token } = await Preferences.get({ key: 'token' });

    url.searchParams.set('format', 'xml');
    url.searchParams.set('download', 'true');

    if (token) {
        url.searchParams.set('token', token);
    }

    await std(url.toString(), {
        download: true,
    });
}

function setBasemapType(type: string): void {
    selectedBasemapType.value = type as BasemapSourceType;
    tilejson.value.url = '';
    vectorLayers.value = [];

    if (selectedBasemapType.value === 'tilejson' || selectedBasemapType.value === 'upload') {
        return;
    }

    const inferred = inferBasemapType(editing.value.url);
    if (props.basemap.id && inferred === selectedBasemapType.value) return;

    Object.assign(editing.value, BasemapTypeConfig[selectedBasemapType.value].defaults);
    editing.value.url = '';
}

function resetBasemapType(): void {
    selectedBasemapType.value = null;
    tilejson.value.url = '';
    vectorLayers.value = [];
}

async function fetchTileJSON(): Promise<void> {
    loading.value = true;
    try {
        const importType = selectedBasemapType.value;
        if (!importType) throw new Error('Basemap type not selected');

        const isArcGISImport = importType === 'featureserver'
            || importType === 'mapserver'
            || importType === 'imageserver';

        const res = await server.PUT('/api/basemap', isArcGISImport
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: {
                    type: importType,
                    url: tilejson.value.url,
                } satisfies BasemapImportBody,
            }
            : {
                headers: { 'Content-Type': 'text/plain' },
                body: tilejson.value.url,
            });

        if (res.error) throw new Error(res.error.message);

        const data = res.data as BasemapImport;

        editing.value = normalizeEditing(data);
        vectorLayers.value = Array.isArray(data.vector_layers)
            ? data.vector_layers as VectorLayerDescriptor[]
            : [];
        selectedBasemapType.value = inferBasemapType(editing.value.url) ?? 'zxy';
        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

function processUpload(body: unknown): void {
    editing.value = normalizeEditing(body as BasemapImport);
    vectorLayers.value = Array.isArray((body as BasemapImport).vector_layers)
        ? (body as BasemapImport).vector_layers as VectorLayerDescriptor[]
        : [];
    selectedBasemapType.value = inferBasemapType(editing.value.url) ?? 'zxy';
}

async function fetchBasemap(): Promise<void> {
    const basemapId = props.basemap.id;
    if (basemapId === undefined) throw new Error('Missing basemap id');

    loading.value = true;
    const res = await server.GET('/api/basemap/{:basemapid}', {
        params: {
            path: {
                ':basemapid': basemapId,
            }
        }
    });

    if (res.error) throw new Error(res.error.message);
    if (typeof res.data === 'string') throw new Error('Unexpected basemap download response');

    const data = res.data as BasemapListItem;

    editing.value = normalizeEditing(data);
    selectedBasemapType.value = inferBasemapType(editing.value.url) ?? 'zxy';

    vectorLayers.value = [];
    if (editing.value.type === 'vector') {
        const tileRes = await server.GET('/api/basemap/{:basemapid}/tiles', {
            params: {
                path: {
                    ':basemapid': basemapId,
                }
            }
        });

        if (tileRes.error) throw new Error(tileRes.error.message);

        const tileData = tileRes.data;
        vectorLayers.value = Array.isArray(tileData.vector_layers)
            ? tileData.vector_layers as VectorLayerDescriptor[]
            : [];
    }

    loading.value = false;
}

async function create(): Promise<void> {
    errors.value.name = editing.value.name ? '' : 'Cannot be empty';
    errors.value.url = editing.value.url ? '' : 'Cannot be empty';

    if (errors.value.name || errors.value.url) return;

    loading.value = true;
    try {
        const protocol = selectedBasemapType.value;
        if (!protocol || protocol === 'tilejson' || protocol === 'upload') {
            throw new Error('Unsupported basemap protocol');
        }

        const body: Omit<BasemapCreateBody, 'scope' | 'protocol'> = {
            name: editing.value.name,
            sharing_enabled: editing.value.sharing_enabled,
            snapping_enabled: editing.value.snapping_enabled,
            url: editing.value.url,
            overlay: editing.value.overlay,
            hidden: editing.value.hidden,
            tilesize: editing.value.tilesize,
            collection: editing.value.collection.trim().length ? editing.value.collection : null,
            attribution: editing.value.attribution.trim().length ? editing.value.attribution : null,
            frequency: editing.value.frequency,
            minzoom: editing.value.minzoom,
            maxzoom: editing.value.maxzoom,
            format: editing.value.format,
            type: editing.value.type,
            styles: editing.value.styles,
            ...(editing.value.snapping_layer.trim().length ? { snapping_layer: editing.value.snapping_layer } : {}),
            ...(editing.value.encoding ? { encoding: editing.value.encoding } : {}),
            ...(editing.value.bounds.length ? { bounds: editing.value.bounds } : {}),
            ...(editing.value.center.length ? { center: editing.value.center } : {}),
            ...(editing.value.type === 'vector' && editing.value.title.trim().length ? { title: editing.value.title } : {}),
            ...(editing.value.tilejson.trim().length ? { tilejson: editing.value.tilejson } : {}),
        };

        if (props.basemap.id) {
            const basemapId = props.basemap.id;
            if (basemapId === undefined) throw new Error('Missing basemap id');

            const res = await server.PATCH('/api/basemap/{:basemapid}', {
                params: {
                    path: {
                        ':basemapid': basemapId,
                    }
                },
                body: {
                    scope: scope.value,
                    protocol,
                    ...body,
                } satisfies BasemapUpdateBody,
            });

            if (res.error) throw new Error(res.error.message);
        } else {
            const res = await server.POST('/api/basemap', {
                body: {
                    scope: scope.value,
                    protocol,
                    ...body,
                } satisfies BasemapCreateBody,
            });

            if (res.error) throw new Error(res.error.message);
        }

        loading.value = false;
        emit('close');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteBasemap(): Promise<void> {
    const basemapId = props.basemap.id;
    if (basemapId === undefined) throw new Error('Missing basemap id');

    loading.value = true;
    try {
        const res = await server.DELETE('/api/basemap/{:basemapid}', {
            params: {
                path: {
                    ':basemapid': basemapId,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

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
