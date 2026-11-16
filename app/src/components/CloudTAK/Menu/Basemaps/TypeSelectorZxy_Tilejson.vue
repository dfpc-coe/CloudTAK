<template>
    <div class='row row-cards'>
        <TypeSelectorSelected
            :type='type'
            @change-type='emit("change-type")'
        />

        <TablerLoading
            v-if='loading'
            desc='Fetching Metadata'
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
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';
import { BasemapTypeConfig } from './types.ts';
import { fromImport, importBasemap } from './modes.ts';
import type { BasemapImported } from './modes.ts';
import { TablerButton, TablerInput, TablerLoading } from '@tak-ps/vue-tabler';
import type { BasemapSourceType } from './types.ts';

const props = defineProps<{
    type: BasemapSourceType;
}>();

const emit = defineEmits<{
    'change-type': [];
    imported: [value: BasemapImported];
}>();

const config = BasemapTypeConfig[props.type];
const url = ref('');
const loading = ref(false);

async function fetchMetadata(): Promise<void> {
    loading.value = true;
    try {
        emit('imported', fromImport(await importBasemap(url.value)));
    } finally {
        loading.value = false;
    }
}
</script>
