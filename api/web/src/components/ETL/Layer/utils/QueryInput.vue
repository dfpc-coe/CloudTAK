<template>
    <TablerInput
        :model-value='modelValue'
        :label='label'
        :placeholder='placeholder'
        :disabled='disabled'
        :error='error_str'
        @update:model-value='emit("update:modelValue", $event)'
    >
        <template #default>
            <slot />
        </template>
    </TablerInput>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import jsonata from 'jsonata';
import { TablerInput } from '@tak-ps/vue-tabler';

const props = defineProps({
    modelValue: {
        type: String,
        default: ''
    },
    label: {
        type: String,
        default: 'JSONata Query'
    },
    placeholder: {
        type: String,
        default: ''
    },
    disabled: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['update:modelValue']);

const error_str = computed(() => {
    if (!props.modelValue) return '';

    try {
        jsonata(props.modelValue);
        return '';
    } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
        return err.message;
    }
});
</script>
