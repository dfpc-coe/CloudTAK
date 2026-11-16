<template>
    <div class='row row-cards'>
        <TypeSelectorSelected
            :type='type'
            @change-type='emit("change-type")'
        />

        <div class='col-12'>
            <Upload
                method='PUT'
                :url='uploadUrl'
                @done='emit("imported", fromImport($event as BasemapImport))'
                @cancel='emit("change-type")'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import Upload from '../../../util/Upload.vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';
import { stdurl } from '../../../../std.ts';
import { fromImport } from './modes.ts';
import type { BasemapImported } from './modes.ts';
import type { BasemapImport, BasemapSourceType } from './types.ts';

defineProps<{
    type: BasemapSourceType;
}>();

const emit = defineEmits<{
    'change-type': [];
    imported: [value: BasemapImported];
}>();

const uploadUrl = stdurl('/api/basemap');
</script>
