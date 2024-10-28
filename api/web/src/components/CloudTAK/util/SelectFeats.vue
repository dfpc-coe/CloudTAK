<template>
    <div
        class='col-12'
        style='max-height: 400px'
    >
        <TablerLoading v-if='loading'/>
        <template v-else-if='!share'>
            <div class='sticky-top col-12 d-flex align-items-center user-select-none'>
                <div class='subheader mx-2 my-2'>
                    Selected Features
                </div>
                <div class='ms-auto px-2'>
                    <TablerIconButton
                        title='Clear Selection'
                        @click='selected.clear()'
                    ><IconX :size='20' stroke='1'/></TablerIconButton>
                </div>
            </div>
            <div
                class='overflow-auto'
                style='
                max-height: calc(400px - 36px);
                margin-bottom: 36px;
            '
            >
                <div
                    v-for='select in selected.values()'
                    class='col-12'
                >
                    <Feature
                        :feature='select'
                        deleteAction='emit'
                        @delete='selected.delete(select.properties.id)'
                    />
                </div>
            </div>
            <div
                style='height: 36px; z-index: 2000;'
                class='position-absolute bottom-0 start-0 end-0 px-2 bg-dark'
            >
                <div class='d-flex align-items-center'>
                    <TablerButton
                        style='height: 30px; width: 200px;'
                        class='me-1'
                        @click='share = true'
                    >
                        <IconPackageExport :size='20' stroke='1'/>
                        <span class='mx-2'>Share</span>
                    </TablerButton>
                <TablerDropdown>
                    <TablerButton
                        title='More Options'
                        style='height: 30px'
                    >
                        <IconDotsVertical :size='20' stroke='1'/>
                    </TablerButton>

                    <template #dropdown>
                        <div clas='col-12'>
                            <div @click='shareMissionFeatures' class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2'>
                                <IconAmbulance :size='32' stroke='1'/>
                                Add to Data Sync
                            </div>
                            <div @click='deleteFeatures' class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2'>
                                <IconTrash :size='32' stroke='1'/>
                                Delete Features
                            </div>
                        </div>
                    </template>
                </TablerDropdown>
                </div>
            </div>
        </template>
        <template v-else>
            <Share
                style='height: 400px;'
                :feats='Array.from(selected.values())'
                :compact='true'
                @done='selected.clear()'
                @cancel='share = false'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import Feature from './Feature.vue';
import { useCOTStore } from '/src/stores/cots.ts';
import {
    IconPackageExport,
    IconDotsVertical,
    IconAmbulance,
    IconTrash,
    IconX,
} from '@tabler/icons-vue';
import {
    TablerButton,
    TablerLoading,
    TablerDropdown,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import Share from './Share.vue';

const cotStore = useCOTStore();

const props = defineProps({
    selected: {
        type: Object,
        required: true
    }
});

const loading = ref(false);
const share = ref(false);

async function deleteFeatures() {
    loading.value = true;

    for (const id of props.selected.keys()) {
        await cotStore.delete(id);
    }

    props.selected.clear()

    loading.value = false;
}
</script>
