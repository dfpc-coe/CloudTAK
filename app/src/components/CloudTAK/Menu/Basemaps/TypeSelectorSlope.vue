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
                    desc='Loading Slope Metadata'
                />
                <BasemapPicker
                    v-else
                    :types='["raster-dem"]'
                    placeholder='Filter terrain basemaps'
                    empty-label='No Terrain (raster-dem) Basemaps'
                    loading-label='Loading Terrain Basemaps'
                    @select='select'
                >
                    <template #icon>
                        <IconMountain
                            :size='24'
                            stroke='1'
                        />
                    </template>
                </BasemapPicker>
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
                    <SlopeClasses
                        :model-value='parseSlopeArgs(editing.args)'
                        :hint='`Rendered from terrain basemap #${source.dem}. Pixels outside every class stay transparent. Users can override these classes on their own overlay.`'
                        @update:model-value='editing.args = { ...editing.args, ...slopeArgs($event) }'
                    />
                </div>
            </template>
            <template #advanced>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='editing.minzoom'
                        required
                        label='MinZoom'
                    />
                </div>
                <div class='col-md-6'>
                    <TablerInput
                        v-model='editing.maxzoom'
                        required
                        label='MaxZoom'
                    />
                </div>
            </template>
        </TypeSelectorBase>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { Preferences } from '@capacitor/preferences';
import { server, std, stdurl } from '../../../../std.ts';
import BasemapPicker from './BasemapPicker.vue';
import type { PickableBasemap } from './BasemapPicker.vue';
import SlopeClasses from './SlopeClasses.vue';
import TypeSelectorBase from './TypeSelectorBase.vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';
import { fromImport } from './modes.ts';
import {
    cloneSlopeClasses,
    parseSlopeArgs,
    parseSlopeSource,
    slopeArgs,
    slopeTileJSONURL,
    slopeTileURL,
} from './slope.ts';
import type { SlopeSource } from './slope.ts';
import type { BasemapImported, BasemapErrors, BasemapScope } from './modes.ts';
import type { BasemapImport, BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from './types.ts';
import {
    TablerInput,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconMountain,
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
const source = ref<SlopeSource | null>(parseSlopeSource(editing.value.url));

async function select(dem: PickableBasemap): Promise<void> {
    loading.value = true;
    try {
        const config = await server.GET('/api/config/tiles');
        if (config.error) throw new Error(config.error.message);

        const host = config.data.url;

        const url = stdurl(new URL(slopeTileJSONURL(host, dem.id)));
        const { value: token } = await Preferences.get({ key: 'token' });
        if (token) url.searchParams.set('token', token);

        const detail = await std(url) as BasemapImport;

        const imported = fromImport({ ...detail, name: `${dem.name} Slope` }, props.type);
        imported.editing.url = slopeTileURL(host, dem.id);
        imported.editing.tilejson = slopeTileJSONURL(host, dem.id);
        imported.editing.args = slopeArgs(cloneSlopeClasses());

        source.value = { host, dem: dem.id };

        emit('imported', imported);
    } finally {
        loading.value = false;
    }
}
</script>
