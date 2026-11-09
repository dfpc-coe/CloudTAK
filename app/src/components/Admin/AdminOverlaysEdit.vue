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
                    v-if='!mode || !activeMode'
                    :is-system-admin='true'
                    class='mt-3'
                    @select='selectMode'
                />
                <component
                    :is='activeMode.component'
                    v-else
                    v-model:editing='editing'
                    v-model:scope='scope'
                    v-model:warn-sharing='warnSharing'
                    class='mt-3'
                    :type='mode'
                    :basemap-id='basemapId'
                    :vector-layers='vectorLayers'
                    :errors='errors'
                    :is-system-admin='true'
                    @change-type='resetMode'
                    @imported='applyImport'
                />

                <div
                    v-if='ready'
                    class='row g-2 mt-2'
                >
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
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { server } from '../../std.ts';
import { fetchBasemapTileJSON } from '../../utils/tilejson.ts';
import type { TileJSON } from '../../types.ts';
import StyleContainer from '../ETL/Styling/Style.vue';
import UserSelect from '../util/UserSelect.vue';
import BasemapTypeSelector from '../CloudTAK/Menu/Basemaps/TypeSelector.vue';
import {
    BasemapModes,
    beginMode,
    blankEditing,
    resolveMode,
    toBasemapBody,
    validateEditing,
} from '../CloudTAK/Menu/Basemaps/modes.ts';
import type { BasemapErrors, BasemapImported, BasemapScope } from '../CloudTAK/Menu/Basemaps/modes.ts';
import { normalizeEditing } from '../CloudTAK/Menu/Basemaps/types.ts';
import type { BasemapImport, BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from '../CloudTAK/Menu/Basemaps/types.ts';
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
const scope = ref<BasemapScope>('server');
const errors = ref<BasemapErrors>({ name: '', url: '' });

const mode = ref<BasemapSourceType | null>(null);
const vectorLayers = ref<VectorLayerDescriptor[]>([]);
const editing = ref<EditingBasemap>(blankEditing({ overlay: true }));

const activeMode = computed(() => mode.value ? BasemapModes[mode.value] : null);
const ready = computed(() => !!activeMode.value && activeMode.value.ready(editing.value, basemapId.value));

onMounted(async () => {
    if (basemapId.value) {
        await fetchOverlay(basemapId.value);
    }

    loading.value = false;
});

function selectMode(type: BasemapSourceType): void {
    mode.value = type;
    vectorLayers.value = [];
    editing.value = beginMode(type, editing.value);
}

function resetMode(): void {
    mode.value = null;
    vectorLayers.value = [];
}

function applyImport(imported: BasemapImported): void {
    editing.value = imported.editing;
    vectorLayers.value = imported.vectorLayers;
    mode.value = imported.mode;
}

async function deleteOverlay(): Promise<void> {
    loading.value = true;
    try {
        const res = await server.DELETE('/api/basemap/{:basemapid}', {
            params: { path: { ':basemapid': basemapId.value! } },
        });
        if (res.error) throw new Error(res.error.message);
        router.push('/admin/overlay');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function saveOverlay(): Promise<void> {
    errors.value = validateEditing(editing.value);
    if (errors.value.name || errors.value.url) return;

    const protocol = activeMode.value?.protocol;
    if (!protocol) throw new Error('Select a basemap type before saving');

    loading.value = true;
    try {
        const body = toBasemapBody(editing.value, protocol, scope.value);
        const query = username.value ? { impersonate: username.value } : undefined;

        if (basemapId.value) {
            const res = await server.PATCH('/api/basemap/{:basemapid}', {
                params: {
                    path: { ':basemapid': basemapId.value },
                    query,
                },
                body,
            });
            if (res.error) throw new Error(res.error.message);
        } else {
            const res = await server.POST('/api/basemap', {
                params: { query },
                body,
            });
            if (res.error) throw new Error(res.error.message);

            router.push(`/admin/overlay/${res.data.id}`);
        }

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchOverlay(id: number): Promise<void> {
    const overlayRes = await server.GET('/api/basemap/{:basemapid}', {
        params: { path: { ':basemapid': id } },
    });
    if (overlayRes.error) throw new Error(overlayRes.error.message);
    const overlay = overlayRes.data;
    if (typeof overlay === 'string') throw new Error('Unexpected response');

    username.value = overlay.username ?? '';
    scope.value = overlay.username ? 'user' : 'server';

    editing.value = normalizeEditing(overlay as unknown as BasemapImport);
    mode.value = resolveMode(editing.value.url, overlay.protocol);

    vectorLayers.value = [];
    if (editing.value.type === 'vector') {
        const tilesData = await fetchBasemapTileJSON<TileJSON>(id);
        vectorLayers.value = Array.isArray(tilesData.vector_layers)
            ? tilesData.vector_layers as VectorLayerDescriptor[]
            : [];
    }
}
</script>
