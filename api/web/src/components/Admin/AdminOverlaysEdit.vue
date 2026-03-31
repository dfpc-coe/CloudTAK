<template>
    <div>
        <div class='card-header'>
            <TablerIconButton
                title='Back'
                @click='$router.push("/admin/overlay")'
            >
                <IconCircleArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <h1 class='card-title'>
                <span
                    v-if='isNew'
                    class='mx-2'
                >New Overlay</span>
                <span
                    v-else
                    class='mx-2'
                >Edit Overlay</span>
            </h1>
        </div>
        <div
            style='min-height: 20vh; margin-bottom: 61px'
            class='px-2'
        >
            <TablerLoading v-if='loading' />
            <template v-else>
                <div class='row g-2'>
                    <div class='col-12'>
                        <label class='mx-2 my-1'>Ownership</label>
                        <div class='border rounded'>
                            <UserSelect
                                v-model='username'
                            />
                        </div>
                    </div>
                </div>

                <BasemapTypeSelector
                    v-if='showTypeSelector'
                    :is-system-admin='true'
                    class='mt-3'
                    @select='setBasemapType'
                />
                <component
                    :is='activeSelectorComponent'
                    v-else-if='activeSelectorComponent'
                    :basemap-id='basemapId'
                    :editing='editing'
                    :vector-layers='vectorLayers'
                    :errors='errors'
                    :scope='scope'
                    :warn-sharing='warnSharing'
                    :is-system-admin='true'
                    :url='tilejsonUrl'
                    :upload-url='uploadUrl'
                    :upload-headers='uploadHeadersValue'
                    @change-type='resetBasemapType'
                    @update:scope='scope = $event'
                    @update:warn-sharing='warnSharing = $event'
                    @update:url='tilejsonUrl = $event'
                    @fetch='fetchTileJSON'
                    @done='processImport($event)'
                />

                <template v-if='showStylesAndFooter'>
                    <div class='row g-2 mt-2'>
                        <div class='col-12'>
                            <StyleContainer
                                v-model='editing.styles'
                                :advanced='true'
                            />
                        </div>
                        <div class='col-12 d-flex py-2'>
                            <TablerDelete
                                v-if='basemapId'
                                @delete='deleteOverlay'
                            />
                            <div class='ms-auto'>
                                <TablerButton
                                    class='btn-primary'
                                    @click='saveOverlay'
                                >
                                    Submit
                                </TablerButton>
                            </div>
                        </div>
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { std, stdurl } from '../../std.ts';
import StyleContainer from '../ETL/Styling/Style.vue';
import UserSelect from '../util/UserSelect.vue';
import BasemapTypeSelector from '../CloudTAK/Menu/Basemaps/TypeSelector.vue';
import TypeSelectorFeatureServer from '../CloudTAK/Menu/Basemaps/TypeSelectorFeatureServer.vue';
import TypeSelectorImageServer from '../CloudTAK/Menu/Basemaps/TypeSelectorImageServer.vue';
import TypeSelectorMapServer from '../CloudTAK/Menu/Basemaps/TypeSelectorMapServer.vue';
import TypeSelectorZxy_Tilejson from '../CloudTAK/Menu/Basemaps/TypeSelectorZxy_Tilejson.vue';
import TypeSelectorZxy_Upload from '../CloudTAK/Menu/Basemaps/TypeSelectorZxy_Upload.vue';
import TypeSelectorZxy from '../CloudTAK/Menu/Basemaps/TypeSelectorZxy.vue';
import TypeSelectorHosted from '../CloudTAK/Menu/Basemaps/TypeSelectorHosted.vue';
import { BasemapTypeConfig, inferBasemapType, normalizeEditing } from '../CloudTAK/Menu/Basemaps/types.ts';
import type { BasemapImport, BasemapImportRequest, BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from '../CloudTAK/Menu/Basemaps/types.ts';
import {
    IconCircleArrowLeft,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerButton,
    TablerDelete,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const route = useRoute();
const router = useRouter();

const isNew = computed(() => route.params.overlay === 'new');
const basemapId = computed(() => isNew.value ? undefined : Number(route.params.overlay));

const loading = ref(true);
const warnSharing = ref(false);
const username = ref('');
const tilejsonUrl = ref('');

const selectedBasemapType = ref<BasemapSourceType | null>(null);
const vectorLayers = ref<VectorLayerDescriptor[]>([]);

const errors = ref<Record<'name' | 'url', string>>({
    name: '',
    url: '',
});

const scope = ref<'user' | 'server'>('server');

const editing = ref<EditingBasemap>({
    name: '',
    url: '',
    type: 'vector',
    minzoom: 0,
    maxzoom: 16,
    tilesize: 256,
    attribution: '',
    sharing_enabled: true,
    format: 'mvt',
    bounds: [-180, -90, 180, 90],
    center: [0, 0],
    collection: '',
    title: 'callsign',
    overlay: true,
    hidden: false,
    frequency: null,
    snapping_enabled: false,
    snapping_layer: '',
    styles: [],
    tilejson: '',
});

const showTypeSelector = computed(() => {
    return isNew.value && !selectedBasemapType.value;
});

const metadataImportTypes: BasemapSourceType[] = ['imageserver', 'mapserver', 'featureserver'];

const showStylesAndFooter = computed(() => {
    return !loading.value
        && !showTypeSelector.value
        && !!selectedBasemapType.value
        && selectedBasemapType.value !== 'upload'
        && selectedBasemapType.value !== 'tilejson'
        && selectedBasemapType.value !== 'hosted'
        && (basemapId.value || editing.value.url);
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
const uploadHeadersValue = computed<Record<string, string>>(() => {
    return {
        Authorization: `Bearer ${localStorage['token']}`,
    };
});

onMounted(async () => {
    if (!isNew.value) {
        await fetchOverlay();
    } else {
        loading.value = false;
    }
});

function setBasemapType(type: string): void {
    selectedBasemapType.value = type as BasemapSourceType;
    tilejsonUrl.value = '';
    vectorLayers.value = [];

    if (selectedBasemapType.value === 'tilejson' || selectedBasemapType.value === 'upload') {
        return;
    }

    const inferred = inferBasemapType(editing.value.url);
    if (basemapId.value && inferred === selectedBasemapType.value) return;

    Object.assign(editing.value, BasemapTypeConfig[selectedBasemapType.value].defaults);
    editing.value.url = '';
}

function resetBasemapType(): void {
    selectedBasemapType.value = null;
    tilejsonUrl.value = '';
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
                    url: tilejsonUrl.value,
                } satisfies BasemapImportRequest),
            }
            : {
                method: 'PUT',
                headers: { 'Content-Type': 'text/plain' },
                body: tilejsonUrl.value,
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

function processImport(body: unknown): void {
    editing.value = normalizeEditing(body as BasemapImport);
    vectorLayers.value = Array.isArray((body as BasemapImport).vector_layers)
        ? (body as BasemapImport).vector_layers as VectorLayerDescriptor[]
        : [];
    selectedBasemapType.value = inferBasemapType(editing.value.url) ?? 'zxy';
}

async function deleteOverlay(): Promise<void> {
    loading.value = true;
    try {
        await std(`/api/basemap/${basemapId.value}`, { method: 'DELETE' });
        router.push('/admin/overlay');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function saveOverlay(): Promise<void> {
    errors.value.name = editing.value.name ? '' : 'Cannot be empty';
    errors.value.url = editing.value.url ? '' : 'Cannot be empty';

    if (errors.value.name || errors.value.url) return;

    loading.value = true;
    try {
        const body: Omit<Partial<EditingBasemap>, 'tilesize' | 'collection' | 'attribution' | 'bounds' | 'center' | 'frequency' | 'snapping_layer'> & {
            bounds?: number[];
            center?: number[];
            tilesize?: number | null;
            collection?: string | null;
            attribution?: string | null;
            frequency?: number | null;
            snapping_layer?: string | null;
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

        if (body.frequency) {
            body.frequency = Number(body.frequency);
        } else {
            body.frequency = null;
        }

        if (!body.snapping_enabled) {
            body.snapping_layer = null;
        }

        if (basemapId.value) {
            const url = stdurl(`/api/basemap/${basemapId.value}`);
            if (username.value) url.searchParams.set('impersonate', username.value);
            await std(url, {
                method: 'PATCH',
                body: { scope: scope.value, protocol: selectedBasemapType.value, ...body },
            });
        } else {
            const url = stdurl('/api/basemap');
            if (username.value) url.searchParams.set('impersonate', username.value);
            const res = await std(url, {
                method: 'POST',
                body: { scope: scope.value, protocol: selectedBasemapType.value, ...body },
            }) as { id: number };

            router.push(`/admin/overlay/${res.id}`);
        }

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchOverlay(): Promise<void> {
    loading.value = true;

    const res = await std(`/api/basemap/${route.params.overlay}`) as Record<string, unknown>;

    username.value = (res.username as string) ?? '';
    scope.value = res.username ? 'user' : 'server';

    editing.value = normalizeEditing(res as BasemapImport);
    selectedBasemapType.value = inferBasemapType(editing.value.url)
        ?? (res.protocol as BasemapSourceType)
        ?? 'zxy';

    vectorLayers.value = [];
    if (editing.value.type === 'vector') {
        const tileData = await std(`/api/basemap/${route.params.overlay}/tiles`) as BasemapImport;
        vectorLayers.value = Array.isArray(tileData.vector_layers)
            ? tileData.vector_layers as VectorLayerDescriptor[]
            : [];
    }

    loading.value = false;
}
</script>
