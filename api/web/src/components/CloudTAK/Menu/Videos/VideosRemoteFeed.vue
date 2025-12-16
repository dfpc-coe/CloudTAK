<template>
    <div
        class='rounded mx-2 my-2'
        style='
            border-style: solid;
            border-color: #3E5E84;
            border-width: 1px;
        '
    >
        <div class='d-flex mt-2 mx-2'>
            <div>
                <IconCast
                    :size='24'
                    stroke='1'
                />
                <label class='mx-2'>Video Feed</label>
            </div>
            <div class='ms-auto btn-list'>
                <TablerDelete
                    size='24'
                    title='Delete Feed'
                    displaytype='icon'
                    @delete='emit("delete")'
                />
            </div>
        </div>

        <div class='row g-2 rounded mx-2 my-2 pb-2 px-2'>
            <div class='col-12'>
                <TablerInput
                    v-model='feed.alias'
                    label='Feed Name'
                >
                    <TablerToggle
                        v-model='feed.active'
                        label='Active'
                    />
                </TablerInput>
            </div>

            <div class='col-12'>
                <TablerInput
                    v-model='feed.url'
                    label='Feed URL'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import type { VideoConnectionFeed } from '../../../../types.ts';
import {
    TablerInput,
    TablerDelete,
    TablerToggle
} from '@tak-ps/vue-tabler'
import {
    IconCast
} from '@tabler/icons-vue';

const props = defineProps<{
    modelValue: VideoConnectionFeed
}>();

const feed = ref(props.modelValue);

const emit = defineEmits(['update:modelValue', 'delete']);

watch(feed.value, () => {
    emit('update:modelValue', feed.value);
})

</script>
