<template>
    <div class='row row-cards'>
        <TypeSelectorBase
            v-bind='props'
            v-model:editing='editing'
            type='slope'
            @change-type='emit("change-type")'
            @update:scope='emit("update:scope", $event)'
            @update:warn-sharing='emit("update:warnSharing", $event)'
        >
            <template #advanced>
                <div class='col-12'>
                    <TablerEnum
                        v-model='editing.encoding'
                        required
                        label='DEM Encoding'
                        :options='["mapbox", "terrarium"]'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='editing.minzoom'
                        required
                        label='MinZoom'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='editing.maxzoom'
                        required
                        label='MaxZoom'
                    />
                </div>
                <div class='col-md-4'>
                    <TablerInput
                        v-model='editing.tilesize'
                        label='DEM Tile Size'
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

const editing = defineModel<EditingBasemap>('editing', { required: true });

const props = defineProps<{
    basemapId?: number;
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

if (!props.basemapId && !editing.value.url) {
    Object.assign(editing.value, {
        name: editing.value.name || 'Avalanche Slope Angle',
        url: 'https://tiles.mapterhorn.com/{$z}/{$x}/{$y}.webp',
        encoding: 'terrarium',
        attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
        overlay: true,
    });
}
</script>
