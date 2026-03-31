<template>
    <div class='row g-2'>
        <div class='col-12'>
            <TablerInput
                v-model='filter'
                icon='search'
                placeholder='Filter basemap types'
            />
        </div>

        <div
            v-for='option in filteredOptions'
            :key='option.id'
            class='col-12 col-md-6 col-xl-4'
        >
            <StandardItem
                class='h-100 d-flex align-items-center gap-3 px-3 py-3'
                :class='modelValue === option.id ? "bg-blue" : ""'
                @click='select(option.id)'
            >
                <div class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 p-2'>
                    <component
                        :is='option.icon'
                        :size='28'
                        stroke='1.5'
                    />
                </div>

                <div>
                    <div class='fw-semibold'>
                        {{ option.label }}
                    </div>
                    <div class='small text-white-50'>
                        {{ option.description }}
                    </div>
                </div>
            </StandardItem>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, ref } from 'vue';
import StandardItem from '../../util/StandardItem.vue';
import { BasemapTypeConfig } from './types.ts';
import type { BasemapSourceType } from './types.ts';
import {
    TablerInput
} from '@tak-ps/vue-tabler';

withDefaults(defineProps<{
    modelValue?: string | null;
}>(), {
    modelValue: null,
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    select: [value: string];
}>();

const filter = ref('');

const options = (Object.keys(BasemapTypeConfig) as BasemapSourceType[]).map((id) => ({
    id,
    label: BasemapTypeConfig[id].label,
    description: BasemapTypeConfig[id].description,
    icon: BasemapTypeConfig[id].icon,
}));

const filteredOptions = computed(() => {
    if (!filter.value) return options;

    const search = filter.value.toLowerCase();

    return options.filter((option) => {
        return option.label.toLowerCase().includes(search)
            || option.description.toLowerCase().includes(search);
    });
});

function select(value: string): void {
    emit('update:modelValue', value);
    emit('select', value);
}
</script>
