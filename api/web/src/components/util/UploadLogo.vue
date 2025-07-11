<template>
    <div class='mb-3'>
        <TablerInput
            id='logoUpload'
            :label='props.label || "Upload PNG Logo"'
            type='file'
            accept='image/png'
            :disabled='props.disabled'
            :error='error'
            @change='onFileChange'
        />
    </div>
    <div
        v-if='base64Data'
        class='mt-3 row d-flex align-items-center justify-content-center'
    >
        <img
            :src='base64Data'
            alt='Logo Preview'
            class='img-thumbnail'
            style='max-width: 200px;'
        >
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import {
    TablerInput
} from '@tak-ps/vue-tabler'

const emit = defineEmits(['update:modelValue']);

const props = defineProps<{
    modelValue?: string;
    label?: string;
    disabled?: boolean;
}>();

const base64Data = ref<string | undefined>(props.modelValue);
const error = ref('');

watch(base64Data, () => {
    console.error('base64Data changed:', base64Data.value);
    emit('update:modelValue', base64Data.value);
})

function onFileChange(event: Event) {
    const target = event.target as HTMLInputElement;

    error.value = '';

    if (!target.files || target.files.length === 0) {
        throw new Error('Could not read file from input');
    }

    const file = target.files[0];
    if (!file) return;

    if (file.type !== 'image/png') {
        error.value = 'Please upload a PNG file.';
        base64Data.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        base64Data.value = (e.target && e.target.result) ? String(e.target.result) : undefined;
    };
    reader.onerror = () => {
        error.value = 'Failed to read file.';
        base64Data.value = '';
    };

    reader.readAsDataURL(file);
}
</script>
