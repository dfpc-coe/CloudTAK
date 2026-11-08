<template>
    <TablerInput
        v-model='model.name'
        label='Name'
        placeholder='Incident Report'
        class='pb-2'
        :autofocus='true'
    />

    <TablerInput
        v-model='model.url'
        label='URL'
        placeholder='https://example.com or tel:+18005550100'
        @keyup.enter='model.url.trim() && emit("save")'
    />

    <div class='d-flex align-items-center justify-content-end gap-2 mt-2'>
        <button
            type='button'
            class='btn btn-sm'
            @click='emit("cancel")'
        >
            Cancel
        </button>
        <button
            type='button'
            class='btn btn-sm btn-primary'
            :disabled='!model.url.trim()'
            @click='emit("save")'
        >
            Save
        </button>
    </div>
</template>

<script setup lang='ts'>
/** PropertyCoreEntityLinkFields - the inline editor of one Link: name & URL with save and cancel below - Enter saves */
import { TablerInput } from '@tak-ps/vue-tabler';
import type { CoreEntityLink } from '../../../types.ts';

const model = defineModel<CoreEntityLink>({ required: true });

const emit = defineEmits<{
    (e: 'save'): void;
    (e: 'cancel'): void;
}>();
</script>
