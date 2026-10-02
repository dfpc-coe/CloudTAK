<template>
    <div class='row row-cards'>
        <TypeSelectorSelected
            type='upload'
            @change-type='emit("change-type")'
        />

        <div class='col-12'>
            <Upload
                method='PUT'
                :url='uploadUrl'
                @done='emit("done", $event)'
                @cancel='emit("change-type")'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import Upload from '../../../util/Upload.vue';
import TypeSelectorSelected from './TypeSelectorSelected.vue';

defineProps<{
    uploadUrl: URL;
}>();

const emit = defineEmits<{
    'change-type': [];
    done: [value: unknown];
}>();
</script>