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
                @select='setBasemapType'
            />
            <component
                :is='activeSelectorComponent'
                v-else-if='activeSelectorComponent'
                :type='selectedBasemapType'
                :basemap-id='props.basemap.id'
                :editing='editing'
                :vector-layers='vectorLayers'
                :errors='errors'
                :scope='scope'
                :warn-sharing='warnSharing'
                :is-system-admin='isSystemAdmin'
                :url='tilejson.url'
                :upload-url='uploadUrl'
                :upload-headers='uploadHeadersValue'
                @change-type='resetBasemapType'
                @update:scope='scope = $event'
                @update:warnSharing='warnSharing = $event'
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
import { std, stdurl } from '../../../../std.ts';
import ProfileConfig from '../../../../base/profile.ts';
import BasemapTypeSelector from './TypeSelector.vue';
import TypeSelectorArcGIS from './TypeSelectorArcGIS.vue';
import TypeSelectorZxy_Tilejson from './TypeSelectorZxy_Tilejson.vue';
import TypeSelectorZxy_Upload from './TypeSelectorZxy_Upload.vue';
import TypeSelectorZxy from './TypeSelectorZxy.vue';
import { BasemapTypeConfig, inferBasemapType, normalizeEditing } from './types.ts';
import type { BasemapListItem, BasemapImport, BasemapImportRequest, BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from './types.ts';
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
        && selectedBasemapType.value !== 'tilejson';
});

const activeSelectorComponent = computed(() => {
    switch (selectedBasemapType.value) {
    case 'zxy': return TypeSelectorZxy;
    case 'imageserver':
    case 'mapserver':
    case 'featureserver': return TypeSelectorArcGIS;
    case 'tilejson': return TypeSelectorZxy_Tilejson;
    case 'upload': return TypeSelectorZxy_Upload;
    default: return null;
    }
});

const uploadUrl = computed(() => stdurl('/api/basemap'));
const uploadHeadersValue = computed<Record<string, string>>(() => {
    return {
        Authorization: `Bearer ${localStorage['token']}`,
    };
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
        const isArcGISImport = importType === 'featureserver'
            || importType === 'mapserver'
            || importType === 'imageserver';

        const data = await std('/api/basemap', isArcGISImport
            ? {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: importType,
                    url: tilejson.value.url,
                } satisfies BasemapImportRequest),
            }
            : {
                method: 'PUT',
                headers: { 'Content-Type': 'text/plain' },
                body: tilejson.value.url,
            }) as BasemapImport;

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
    loading.value = true;
    const data = await std(`/api/basemap/${props.basemap.id}`) as BasemapListItem;
    editing.value = normalizeEditing(data);
    selectedBasemapType.value = inferBasemapType(editing.value.url) ?? 'zxy';

    vectorLayers.value = [];
    if (props.basemap.id && editing.value.type === 'vector') {
        const tileData = await std(`/api/basemap/${props.basemap.id}/tiles`) as BasemapImport;
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

        if (editing.value.type !== 'vector' || !editing.value.title || editing.value.title.trim().length === 0) {
            delete body.title;
        }

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
