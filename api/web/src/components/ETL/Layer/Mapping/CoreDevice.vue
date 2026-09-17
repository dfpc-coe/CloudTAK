<template>
    <div class='row g-2'>
        <div class='col-12'>
            <span class='text-muted subheader'>Device Properties</span>
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
    IconBox,
    IconCategory,
    IconBarcode,
    IconVersions,
    IconHeartbeat,
    IconBattery,
    IconTestPipe,
    IconLicense,
    IconBlockquote,
    IconBuildingFactory2,
} from '@tabler/icons-vue';
import { TablerToggle } from '@tak-ps/vue-tabler';

type FieldValue = string | number | boolean;

interface Field {
    key: string;
    label: string;
    icon: Component;
    placeholder: string;
    kind?: 'template' | 'boolean' | 'number';
}

const fields: Field[] = [
    { key: 'name', label: 'Name', icon: IconTag, placeholder: 'Name Field' },
    { key: 'type', label: 'Type', icon: IconCategory, placeholder: 'MIL-STD-2525E Symbol ID' },
    { key: 'manufacturer', label: 'Manufacturer', icon: IconBuildingFactory2, placeholder: 'ie: Ortec, Nucsafe, DJI' },
    { key: 'model', label: 'Model', icon: IconBox, placeholder: 'ie: Micro Detective, IdentiFINDER 2' },
    { key: 'serial', label: 'Serial', icon: IconBarcode, placeholder: 'Manufacturer assigned Serial Number' },
    { key: 'firmware', label: 'Firmware', icon: IconVersions, placeholder: 'Firmware/Software revision' },
    { key: 'status', label: 'Status', icon: IconHeartbeat, placeholder: 'ie: Full, Reduced, Unknown' },
    { key: 'battery', label: 'Battery', icon: IconBattery, placeholder: 'Battery percentage (0-100)', kind: 'number' },
    { key: 'simulated', label: 'Simulated', icon: IconTestPipe, placeholder: 'Device is a simulated data source', kind: 'boolean' },
    { key: 'external_id', label: 'External ID', icon: IconLicense, placeholder: 'ID in an external system' },
    { key: 'remarks', label: 'Remarks', icon: IconBlockquote, placeholder: 'Remarks Field' },
];

const defaults: Record<string, FieldValue> = {
    simulated: false,
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

        const value = values.value[field.key];
        if (field.kind === 'number' && value !== '' && !isNaN(Number(value))) {
            res[field.key] = Number(value);
        } else {
            res[field.key] = value;
        }
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
