<template>
    <div class='row'>
        <div
            v-if='label'
            class='col-12 my-1'
        >
            <div class='px-2'>
                <span
                    class='user-select-none'
                    v-text='label'
                />
            </div>
        </div>
        <div class='col-12'>
            <select
                v-model='current'
                :disabled='disabled'
                class='form-select'
            >
                <option
                    v-for='option in options'
                    :key='option'
                    :value='option'
                    v-text='nameFor(option)'
                />
            </select>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import { COORD_MODES } from '../../utils/coordinateFormat.ts';

const props = withDefaults(defineProps<{
    modelValue: string;
    options: string[];
    label?: string;
    disabled?: boolean;
}>(), {
    label: '',
    disabled: false
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
}>();

const current = ref<string>(props.modelValue);

watch(() => props.modelValue, (value) => {
    current.value = value;
});

watch(current, (value) => {
    if (value !== props.modelValue) emit('update:modelValue', value);
});

function nameFor(value: string): string {
    return COORD_MODES.find((mode) => mode.value === value)?.title ?? value;
}
</script>
