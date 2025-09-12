<template>
    <Mentionable
        :keys='keys'
        :items='schemalist'
    >
        <TablerInput
            v-model='template'
            :label='props.label'
            :disabled='props.disabled'
            :description='props.description'
            :rows='templateRows'
            :placeholder='props.placeholder'
        />

        <template #no-result>
            <div class='subheader mx-2 my-2 text-center'>
                No Results
            </div>
        </template>

        <template #item-{='{ item }'>
            <div
                class='subheader py-2 px-2 text-center cursor-pointer hover rounded'
                v-text='item.label'
            />
        </template>
    </Mentionable>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { Mentionable } from 'vue-mention';
import { TablerInput } from '@tak-ps/vue-tabler';

// Define props for the component
const props = defineProps({
    modelValue: {
        type: String,
        required: true
    },
    schema: {
        type: Object,
        required: true
    },
    disabled: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
    },
    placeholder: {
        type: String,
    },
    description: {
        type: String,
    },
    rows: {
        type: Number
    }
});

const emit = defineEmits(['update:modelValue']);

const keys = ref(["{"]);
const template = ref(props.modelValue);

const templateRows = computed(() => {
    if (props.rows) return props.rows;

    const rows = template.value.split('\n').length;
    if (rows < 2) return 2;
    return rows;
});

const schemalist = computed(() => {
    if (!props.schema || !props.schema.properties) return [];
    return Object.keys(props.schema.properties).map((ele) => {
        return {
            value: `{${ele}}}`,
            label: ele
        };
    });
});

watch(() => props.modelValue, (newValue) => {
    template.value = newValue;
});

watch(template, (newValue) => {
    emit('update:modelValue', newValue);
});
</script>
