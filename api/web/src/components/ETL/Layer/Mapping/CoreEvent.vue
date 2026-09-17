<template>
    <div class='row g-2'>
        <div class='col-12'>
            <span class='text-muted subheader'>Event Properties</span>
        </div>

        <div
            v-for='field in fields'
            :key='field.key'
            class='col-12 style-item px-2 py-2'
        >
            <div class='d-flex align-items-center'>
                <label class='user-select-none subheader'>
                    <component
                        :is='field.icon'
                        :size='20'
                        stroke='1'
                    /> {{ field.label }}
                </label>
                <div class='ms-auto'>
                    <TablerToggle
                        v-model='enabled[field.key]'
                        :disabled='disabled'
                        label='Enabled'
                    />
                </div>
            </div>
            <template v-if='enabled[field.key]'>
                <TablerToggle
                    v-if='field.kind === "boolean"'
                    v-model='values[field.key]'
                    :disabled='disabled'
                    :label='field.placeholder'
                />
                <TablerEnum
                    v-else-if='field.kind === "enum"'
                    v-model='values[field.key]'
                    :disabled='disabled'
                    :options='field.options'
                />
                <HandleForm
                    v-else
                    :model-value='String(values[field.key])'
                    :placeholder='field.placeholder'
                    :disabled='disabled'
                    :schema='props.schema'
                    @update:model-value='(v: string | number) => values[field.key] = v'
                />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import type { Component } from 'vue';
import HandleForm from '../../../util/HandleForm.vue';
import {
    IconTag,
    IconFlag,
    IconMapPin,
    IconLicense,
    IconCategory,
    IconBlockquote,
    IconCalendarOff,
    IconLock,
} from '@tabler/icons-vue';
import { TablerEnum, TablerToggle } from '@tak-ps/vue-tabler';

type FieldValue = string | number | boolean;

interface Field {
    key: string;
    label: string;
    icon: Component;
    placeholder: string;
    kind?: 'template' | 'boolean' | 'enum';
    options?: string[];
}

const fields: Field[] = [
    { key: 'name', label: 'Name', icon: IconTag, placeholder: 'Name Field' },
    { key: 'type', label: 'Type', icon: IconCategory, placeholder: 'MIL-STD-2525E Symbol ID' },
    { key: 'priority', label: 'Priority', icon: IconFlag, placeholder: 'Priority', kind: 'enum', options: ['none', 'low', 'medium', 'high', 'critical'] },
    { key: 'location', label: 'Location', icon: IconMapPin, placeholder: 'Human readable location' },
    { key: 'remarks', label: 'Remarks', icon: IconBlockquote, placeholder: 'Remarks Field' },
    { key: 'ended', label: 'Ended', icon: IconCalendarOff, placeholder: 'Ended timestamp' },
    { key: 'external_id', label: 'External ID', icon: IconLicense, placeholder: 'ID in an external system' },
    { key: 'editable', label: 'Editable', icon: IconLock, placeholder: 'Others can edit the Event', kind: 'boolean' },
];

const defaults: Record<string, FieldValue> = {
    priority: 'none',
    editable: true,
};

const props = withDefaults(defineProps<{
    modelValue?: Record<string, unknown>;
    schema: Record<string, unknown>;
    disabled?: boolean;
}>(), {
    modelValue: () => ({}),
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown>): void;
}>();

const enabled = ref<Record<string, boolean>>(Object.fromEntries(fields.map((f) => [f.key, false])));
const values = ref<Record<string, FieldValue>>(Object.fromEntries(fields.map((f) => [f.key, defaults[f.key] ?? ''])));

watch(enabled, format, { deep: true });
watch(values, format, { deep: true });

onMounted(() => {
    for (const field of fields) {
        const value = props.modelValue[field.key];
        if (value === undefined || value === null) continue;

        values.value[field.key] = value as FieldValue;
        enabled.value[field.key] = true;
    }

    format();
});

function format() {
    const res: Record<string, unknown> = {};

    for (const field of fields) {
        if (!enabled.value[field.key]) continue;
        res[field.key] = values.value[field.key];
    }

    emit('update:modelValue', res);
}
</script>

<style scoped>
.style-item {
    border: 1px solid transparent;
    border-radius: 4px;
    transition: border-color 0.15s ease;
}

.style-item:hover {
    border-color: var(--tblr-border-color, #e6e7e9);
}
</style>
