<template>
    <div
        class='col-12'
        style='max-height: 400px'
    >
        <template v-if='!share'>
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
                style='height: 36px;'
                class='position-absolute bottom-0 start-0 end-0 px-2 bg-dark'
            >
                <button
                    class='w-100 btn'
                    style='height: 30px'
                    @click='share = true'
                >
                    <IconPackageExport
                        :size='20'
                        stroke='1'
                    />
                    <span class='mx-2'>Share</span>
                </button>
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
import {
    IconPackageExport,
    IconX,
} from '@tabler/icons-vue';
import {
    TablerIconButton
} from '@tak-ps/vue-tabler';
import Share from './Share.vue';

defineProps({
    selected: {
        type: Object,
        required: true
    }
});

const share = ref(false);
</script>
