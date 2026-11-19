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
                v-else-if='!mode || !activeMode'
                :is-system-admin='isSystemAdmin'
                @select='selectMode'
            />
            <component
                :is='activeMode.component'
                v-else
                v-model:editing='editing'
                v-model:scope='scope'
                v-model:warn-sharing='warnSharing'
                :type='mode'
                :basemap-id='basemap.id'
                :vector-layers='vectorLayers'
                :errors='errors'
                :is-system-admin='isSystemAdmin'
                @change-type='resetMode'
                @imported='applyImport'
            />
        </div>

        <div
            v-if='!loading && ready'
            class='modal-footer'
        >
            <div v-if='basemap.id'>
                <TablerDelete
                    label='Delete Basemap / Overlay'
                    @delete='deleteBasemap'
                />
            </div>

            <div class='ms-auto'>
                <TablerButton
                    class='btn-primary'
                    @click='save'
                >
                    Save Basemap / Overlay
                </TablerButton>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Preferences } from '@capacitor/preferences';
import { server, std, stdurl } from '../../../../std.ts';
import ProfileConfig from '../../../../base/profile.ts';
import BasemapTypeSelector from './TypeSelector.vue';
import {
    BasemapModes,
    beginMode,
    blankEditing,
    resolveMode,
    toBasemapBody,
    validateEditing,
} from './modes.ts';
import type { BasemapErrors, BasemapImported, BasemapScope } from './modes.ts';
import { normalizeEditing } from './types.ts';
import type { BasemapListItem, BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from './types.ts';
import {
    IconMap,
    IconDownload,
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerButton,
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

const loading = ref(false);
const warnSharing = ref(false);
const isSystemAdmin = ref(false);
const scope = ref<BasemapScope>(props.basemap.id && !props.basemap.username ? 'server' : 'user');
const errors = ref<BasemapErrors>({ name: '', url: '' });

const mode = ref<BasemapSourceType | null>(null);
const vectorLayers = ref<VectorLayerDescriptor[]>([]);
const editing = ref<EditingBasemap>(blankEditing());

const activeMode = computed(() => mode.value ? BasemapModes[mode.value] : null);
const ready = computed(() => !!activeMode.value && activeMode.value.ready(editing.value, props.basemap.id));

onMounted(async () => {
    const isSysAdmin = await ProfileConfig.get('system_admin');
    isSystemAdmin.value = isSysAdmin?.value ?? false;

    if (props.basemap.id) {
        await fetchBasemap(props.basemap.id);
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

async function fetchBasemap(basemapId: number): Promise<void> {
    loading.value = true;
    try {
        const res = await server.GET('/api/basemap/{:basemapid}', {
            params: { path: { ':basemapid': basemapId } },
        });

        if (res.error) throw new Error(res.error.message);
        if (typeof res.data === 'string') throw new Error('Unexpected basemap download response');

        editing.value = normalizeEditing(res.data as BasemapListItem);
        mode.value = resolveMode(editing.value.url, res.data.protocol);

        vectorLayers.value = [];
        if (editing.value.type === 'vector') {
            const tileRes = await server.GET('/api/basemap/{:basemapid}/tiles', {
                params: { path: { ':basemapid': basemapId } },
            });

            if (tileRes.error) throw new Error(tileRes.error.message);

            vectorLayers.value = Array.isArray(tileRes.data.vector_layers)
                ? tileRes.data.vector_layers as VectorLayerDescriptor[]
                : [];
        }
    } finally {
        loading.value = false;
    }
}

async function save(): Promise<void> {
    errors.value = validateEditing(editing.value);
    if (errors.value.name || errors.value.url) return;

    const protocol = activeMode.value?.protocol;
    if (!protocol) throw new Error('Select a basemap type before saving');

    loading.value = true;
    try {
        const body = toBasemapBody(editing.value, protocol, scope.value);

        if (props.basemap.id) {
            const res = await server.PATCH('/api/basemap/{:basemapid}', {
                params: { path: { ':basemapid': props.basemap.id } },
                body,
            });

            if (res.error) throw new Error(res.error.message);
        } else {
            const res = await server.POST('/api/basemap', { body });

            if (res.error) throw new Error(res.error.message);
        }

        emit('close');
    } finally {
        loading.value = false;
    }
}

async function deleteBasemap(): Promise<void> {
    const basemapId = props.basemap.id;
    if (basemapId === undefined) throw new Error('Missing basemap id');

    loading.value = true;
    try {
        const res = await server.DELETE('/api/basemap/{:basemapid}', {
            params: { path: { ':basemapid': basemapId } },
        });

        if (res.error) throw new Error(res.error.message);

        emit('close');
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.basemap-modal-body {
    min-height: 34rem;
}
</style>
