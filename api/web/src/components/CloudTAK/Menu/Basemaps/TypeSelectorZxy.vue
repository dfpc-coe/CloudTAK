<template>
    <div class='row row-cards'>
        <TypeSelectorBase
            v-bind='props'
            type='zxy'
            @change-type='emit("change-type")'
            @update:scope='emit("update:scope", $event)'
            @update:warnSharing='emit("update:warnSharing", $event)'
        >
            <template #advanced>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='props.editing.minzoom'
                        required
                        label='MinZoom'
                    />
                </div>
                <div class='col-md-3'>
                    <TablerInput
                        v-model='props.editing.maxzoom'
                        required
                        label='MaxZoom'
                    />
                </div>
                <div class='col-12 col-md-3'>
                    <TablerInput
                        v-model='props.editing.tilesize'
                        label='Tile Size'
                    />
                </div>
                <div class='col-12 col-md-3'>
                    <TablerEnum
                        v-model='props.editing.format'
                        required
                        label='Format'
                        :options='["png", "jpeg", "mvt"]'
                    />
                </div>
            </template>
        </TypeSelectorBase>
    </div>
</template>

<script setup lang='ts'>
import TypeSelectorBase from './TypeSelectorBase.vue';
import { TablerEnum, TablerInput } from '@tak-ps/vue-tabler';
import type { EditingBasemap, VectorLayerDescriptor } from './types.ts';

const props = defineProps<{
    basemapId?: number;
    editing: EditingBasemap;
    vectorLayers: VectorLayerDescriptor[];
    errors: Record<'name' | 'url', string>;
    scope: 'user' | 'server';
    warnSharing: boolean;
    isSystemAdmin: boolean;
}>();

const emit = defineEmits<{
    'change-type': [];
    'update:scope': [value: 'user' | 'server'];
    'update:warnSharing': [value: boolean];
}>();
</script>