<template>
    <div class='col-12 py-2'>
        <TablerInput
            v-model='current'
            :rows='32'
            :error='error'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import {
    TablerInput
} from '@tak-ps/vue-tabler'
import { isEqual as deepEqual } from '@react-hookz/deep-equal';

const props = defineProps<{
    modelValue: Record<string, unknown> | unknown[];
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown> | unknown[]): void;
}>();

const error = ref('');
const current = ref(props.modelValue ? JSON.stringify(props.modelValue, null, 4) : '');

watch(() => props.modelValue, () => {
    if (!deepEqual(props.modelValue, JSON.parse(current.value))) {
        current.value = JSON.stringify(props.modelValue, null, 4)
    }
}, { deep: true });

watch(current, () => {
    try {
        emit('update:modelValue', JSON.parse(current.value));
        error.value = '';
    } catch (err) {
        error.value = `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`;
    }
});
</script>
