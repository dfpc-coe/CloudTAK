<template>
    <div class='row row-cards'>
        <template v-if='!source'>
            <TypeSelectorSelected
                :type='type'
                @change-type='emit("change-type")'
            />

            <div class='col-12'>
                <TablerLoading
                    v-if='loading'
                    desc='Building Composite'
                />
                <BasemapPicker
                    v-else
                    :types='["raster"]'
                    :overlays='true'
                    placeholder='Filter raster basemaps for the bottom layer'
                    empty-label='No Raster Basemaps'
                    @select='addLayer'
                />
            </div>
        </template>
        <TypeSelectorBase
            v-else
            v-model:editing='editing'
            v-model:scope='scope'
            v-model:warn-sharing='warnSharing'
            :type='type'
            :basemap-id='basemapId'
            :vector-layers='vectorLayers'
            :errors='errors'
            :is-system-admin='isSystemAdmin'
            @change-type='emit("change-type")'
        >
            <template #source>
                <div class='col-12'>
                    <div class='d-flex align-items-center mb-2'>
                        <label class='form-label mb-0'>Layers (bottom to top)</label>
                        <div class='ms-auto'>
                            <TablerButton
                                class='btn-sm'
                                :class='picking ? "btn-secondary" : "btn-primary"'
                                :disabled='!picking && source.spec.layers.length >= MAX_LAYERS'
                                @click='picking = !picking'
                            >
                                {{ picking ? 'Close' : 'Add Layer' }}
                            </TablerButton>
                        </div>
                    </div>

                    <div
                        v-if='picking'
                        class='border rounded p-2 mb-3'
                    >
                        <BasemapPicker
                            :types='["raster"]'
                            :overlays='true'
                            :exclude='layerIds'
                            placeholder='Filter raster basemaps'
                            empty-label='No Raster Basemaps'
                            @select='addLayer'
                        />
                    </div>

                    <div
                        v-for='(layer, idx) in source.spec.layers'
                        :key='layer.basemap'
                        class='border rounded px-3 py-2 mb-2'
                    >
                        <div class='d-flex align-items-center gap-2'>
                            <IconLayersIntersect
                                :size='20'
                                stroke='1'
                            />
                            <span
                                class='fw-semibold'
                                v-text='names[layer.basemap] ?? `Basemap #${layer.basemap}`'
                            />
                            <div class='ms-auto btn-list'>
                                <TablerIconButton
                                    title='Move Down'
                                    :disabled='idx === 0'
                                    @click='move(idx, -1)'
                                >
                                    <IconArrowDown
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                                <TablerIconButton
                                    title='Move Up'
                                    :disabled='idx === source.spec.layers.length - 1'
                                    @click='move(idx, 1)'
                                >
                                    <IconArrowUp
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                                <TablerIconButton
                                    title='Remove Layer'
                                    @click='source.spec.layers.splice(idx, 1)'
                                >
                                    <IconTrash
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>
                        <div class='row g-2 align-items-end mt-1'>
                            <div class='col-4'>
                                <TablerInput
                                    :model-value='Math.round(layer.opacity * 100)'
                                    type='number'
                                    label='Opacity %'
                                    @update:model-value='layer.opacity = Number($event) / 100'
                                />
                            </div>
                            <div class='col-5'>
                                <TablerEnum
                                    v-model='layer.blend'
                                    label='Blend'
                                    :options='[...BLEND_MODES]'
                                />
                            </div>
                            <div class='col-3'>
                                <TablerToggle
                                    v-model='layer.greyscale'
                                    label='Greyscale'
                                />
                            </div>
                        </div>
                    </div>

                    <div
                        v-if='specError'
                        class='text-danger small'
                        v-text='specError'
                    />
                    <div
                        v-else
                        class='text-white-50 small'
                    >
                        Up to {{ MAX_LAYERS }} raster layers are flattened into one tile set.
                    </div>
                </div>
            </template>
            <template #advanced>
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
                <div class='col-md-3'>
                    <TablerEnum
                        v-model='editing.tilesize'
                        label='Tile Size'
                        :options='[256, 512]'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerEnum
                        v-model='editing.format'
                        required
                        label='Format'
                        :options='[...COMPOSITE_FORMATS]'
                    />
                </div>
            </template>
        </TypeSelectorBase>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref, watch } from 'vue';
import { Preferences } from '@capacitor/preferences';
import { server, std, stdurl } from '../../../../std.ts';
import BasemapPicker from './BasemapPicker.vue';
import type { PickableBasemap } from './BasemapPicker.vue';
import TypeSelectorBase from './TypeSelectorBase.vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';
import { fromImport } from './modes.ts';
import {
    BLEND_MODES,
    COMPOSITE_FORMATS,
    MAX_LAYERS,
    compositeTileJSONURL,
    compositeTileURL,
    normalizeLayer,
    parseCompositeSource,
    validateSpec,
} from './composite.ts';
import type { CompositeFormat, CompositeSource } from './composite.ts';
import type { BasemapImported, BasemapErrors, BasemapScope } from './modes.ts';
import type { BasemapImport, BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from './types.ts';
import {
    TablerButton,
    TablerEnum,
    TablerIconButton,
    TablerInput,
    TablerLoading,
    TablerToggle,
} from '@tak-ps/vue-tabler';
import {
    IconArrowDown,
    IconArrowUp,
    IconLayersIntersect,
    IconTrash,
} from '@tabler/icons-vue';

const editing = defineModel<EditingBasemap>('editing', { required: true });
const scope = defineModel<BasemapScope>('scope', { required: true });
const warnSharing = defineModel<boolean>('warnSharing', { required: true });

const props = defineProps<{
    type: BasemapSourceType;
    basemapId?: number;
    vectorLayers: VectorLayerDescriptor[];
    errors: BasemapErrors;
    isSystemAdmin: boolean;
}>();

const emit = defineEmits<{
    'change-type': [];
    imported: [value: BasemapImported];
}>();

const loading = ref(false);
const picking = ref(false);
const names = ref<Record<number, string>>({});
const source = ref<CompositeSource | null>(parseCompositeSource(editing.value.url));

const layerIds = computed(() => source.value ? source.value.spec.layers.map((layer) => layer.basemap) : []);
const specError = computed(() => source.value ? validateSpec(source.value.spec) : '');

watch([
    () => source.value?.spec.layers,
    () => editing.value.tilesize,
    () => editing.value.format,
], () => {
    if (!source.value) return;

    source.value.spec.tilesize = editing.value.tilesize === 512 ? 512 : 256;
    source.value.spec.format = (COMPOSITE_FORMATS as readonly string[]).includes(editing.value.format)
        ? editing.value.format as CompositeFormat
        : 'png';

    if (specError.value) return;

    editing.value.url = compositeTileURL(source.value.host, source.value.spec);
    editing.value.tilejson = compositeTileJSONURL(source.value.host, source.value.spec);
}, { deep: true });

onMounted(async () => {
    if (!source.value) return;

    await Promise.all(source.value.spec.layers.map(async (layer) => {
        const res = await server.GET('/api/basemap/{:basemapid}', {
            params: { path: { ':basemapid': layer.basemap } },
        });

        if (!res.error && typeof res.data !== 'string') {
            names.value[layer.basemap] = res.data.name;
        }
    }));
});

function move(idx: number, delta: number): void {
    if (!source.value) return;

    const layers = source.value.spec.layers;
    const target = idx + delta;
    if (target < 0 || target >= layers.length) return;

    [layers[idx], layers[target]] = [layers[target], layers[idx]];
}

async function addLayer(basemap: PickableBasemap): Promise<void> {
    names.value[basemap.id] = basemap.name;
    picking.value = false;

    if (source.value) {
        if (source.value.spec.layers.length >= MAX_LAYERS) return;

        source.value.spec.layers.push(normalizeLayer({ basemap: basemap.id }));
        return;
    }

    loading.value = true;
    try {
        const config = await server.GET('/api/config/tiles');
        if (config.error) throw new Error(config.error.message);

        const host = config.data.url;
        const spec = {
            tilesize: basemap.tilesize === 512 ? 512 as const : 256 as const,
            format: 'png' as const,
            layers: [normalizeLayer({ basemap: basemap.id })],
        };

        const url = stdurl(new URL(compositeTileJSONURL(host, spec)));
        const { value: token } = await Preferences.get({ key: 'token' });
        if (token) url.searchParams.set('token', token);

        const detail = await std(url) as BasemapImport;

        const imported = fromImport({ ...detail, name: `${basemap.name} Composite` }, props.type);
        imported.editing.url = compositeTileURL(host, spec);
        imported.editing.tilejson = compositeTileJSONURL(host, spec);

        source.value = { host, spec };

        emit('imported', imported);
    } finally {
        loading.value = false;
    }
}
</script>
