<template>
    <div class='row row-cards'>
        <template v-if='showImportPrompt'>
            <TypeSelectorSelected
                type='mapserver'
                @change-type='emit("change-type")'
            />

            <div class='col-md-12 mt-3'>
                <TablerInput
                    :model-value='props.url'
                    :label='config.urlLabel'
                    :placeholder='config.urlPlaceholder'
                    @update:model-value='emit("update:url", $event)'
                />
            </div>
            <div class='col-md-12 mt-3'>
                <div class='d-flex'>
                    <button
                        class='cursor-pointer btn btn-secondary'
                        @click='emit("change-type")'
                    >
                        Cancel
                    </button>
                    <div class='ms-auto'>
                        <a
                            class='cursor-pointer btn btn-primary'
                            @click='emit("fetch")'
                        >Fetch Metadata</a>
                    </div>
                </div>
            </div>
        </template>
        <template v-else>
            <TypeSelectorBase
                v-bind='props'
                type='mapserver'
                @change-type='emit("change-type")'
                @update:scope='emit("update:scope", $event)'
                @update:warnSharing='emit("update:warnSharing", $event)'
            >
                <template #advanced>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='props.editing.minzoom'
                            required
                            label='MinZoom'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='props.editing.maxzoom'
                            required
                            label='MaxZoom'
                        />
                    </div>
                </template>
            </TypeSelectorBase>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import TypeSelectorBase from './TypeSelectorBase.vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';
import { BasemapTypeConfig } from './types.ts';
import { TablerInput } from '@tak-ps/vue-tabler';
import type { EditingBasemap, VectorLayerDescriptor } from './types.ts';

const props = defineProps<{
    basemapId?: number;
    editing: EditingBasemap;
    vectorLayers: VectorLayerDescriptor[];
    errors: Record<'name' | 'url', string>;
    scope: 'user' | 'server';
    warnSharing: boolean;
    isSystemAdmin: boolean;
    url: string;
}>();

const emit = defineEmits<{
    'change-type': [];
    fetch: [];
    'update:scope': [value: 'user' | 'server'];
    'update:warnSharing': [value: boolean];
    'update:url': [value: string];
}>();

const config = BasemapTypeConfig['mapserver'];
const showImportPrompt = computed(() => !props.basemapId && !props.editing.url);
</script>
