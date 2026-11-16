<template>
    <div class='row row-cards'>
        <template v-if='showImportPrompt'>
            <TypeSelectorSelected
                :type='type'
                @change-type='emit("change-type")'
            />

            <TablerLoading
                v-if='loading'
                desc='Fetching Service Metadata'
            />
            <template v-else>
                <div class='col-md-12 mt-3'>
                    <TablerInput
                        v-model='url'
                        :label='config.urlLabel'
                        :description='config.urlDescription'
                        :placeholder='config.urlPlaceholder'
                    />
                </div>
                <div class='col-md-12 mt-3'>
                    <div class='d-flex'>
                        <TablerButton
                            class='btn-secondary'
                            @click='emit("change-type")'
                        >
                            Cancel
                        </TablerButton>
                        <div class='ms-auto'>
                            <TablerButton
                                class='btn-primary'
                                :disabled='!url'
                                @click='fetchMetadata'
                            >
                                Fetch Metadata
                            </TablerButton>
                        </div>
                    </div>
                </div>
            </template>
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
import { computed, ref } from 'vue';
import TypeSelectorBase from './TypeSelectorBase.vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';
import { BasemapTypeConfig } from './types.ts';
import { fromImport, importBasemap, isImported } from './modes.ts';
import type { BasemapImported, BasemapErrors, BasemapScope } from './modes.ts';
import { TablerButton, TablerInput, TablerLoading } from '@tak-ps/vue-tabler';
import type { BasemapSourceType, EditingBasemap, VectorLayerDescriptor } from './types.ts';

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

const config = BasemapTypeConfig[props.type];
const url = ref('');
const loading = ref(false);

const showImportPrompt = computed(() => !isImported(editing.value, props.basemapId));

async function fetchMetadata(): Promise<void> {
    loading.value = true;
    try {
        const data = await importBasemap({ type: props.type, url: url.value });
        emit('imported', fromImport(data, props.type));
    } finally {
        loading.value = false;
    }
}
</script>
