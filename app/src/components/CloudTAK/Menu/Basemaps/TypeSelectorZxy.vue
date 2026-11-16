<template>
    <div class='row row-cards'>
        <TypeSelectorBase
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
                        :options='["png", "jpeg", "mvt", "webp"]'
                    />
                </div>
            </template>
        </TypeSelectorBase>
    </div>
</template>

<script setup lang='ts'>
import TypeSelectorBase from './TypeSelectorBase.vue';
import { TablerEnum, TablerInput } from '@tak-ps/vue-tabler';
import type { BasemapImported, BasemapErrors, BasemapScope } from './modes.ts';
import type { BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from './types.ts';

const editing = defineModel<EditingBasemap>('editing', { required: true });
const scope = defineModel<BasemapScope>('scope', { required: true });
const warnSharing = defineModel<boolean>('warnSharing', { required: true });

defineProps<{
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
</script>
