<template>
    <div class='row g-2'>
        <div class='col-12'>
            <span class='text-muted subheader'>{{ definition.title }} Properties</span>
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
                    :schema='schema'
                    @update:model-value='(v: string | number) => values[field.key] = v'
                />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import type { Component } from 'vue';
import type { CoreSchema } from '../../../../types.ts';
import HandleForm from '../../../util/HandleForm.vue';
import {
    IconTag,
    IconBox,
    IconFlag,
    IconLock,
    IconMapPin,
    IconBarcode,
    IconBattery,
    IconLicense,
    IconCategory,
    IconTestPipe,
    IconVersions,
    IconHeartbeat,
    IconBlockquote,
    IconCalendarOff,
    IconBuildingFactory2,
} from '@tabler/icons-vue';
import { TablerEnum, TablerToggle } from '@tak-ps/vue-tabler';

type MappingFieldValue = string | number | boolean;

interface MappingField {
    key: string;
    label: string;
    icon: Component;
    placeholder: string;
    kind: 'template' | 'boolean' | 'number' | 'enum';
    options?: string[];
    default?: MappingFieldValue;
}

/** Tabler icons a JSON Schema property can name with its `@icon` hint */
const icons: Record<string, Component> = {
    IconTag,
    IconBox,
    IconFlag,
    IconLock,
    IconMapPin,
    IconBarcode,
    IconBattery,
    IconLicense,
    IconCategory,
    IconTestPipe,
    IconVersions,
    IconHeartbeat,
    IconBlockquote,
    IconCalendarOff,
    IconBuildingFactory2,
};

const props = withDefaults(defineProps<{
    definition: CoreSchema;
    modelValue?: Record<string, unknown>;
    schema: Record<string, unknown>;
    disabled?: boolean;
}>(), {
    modelValue: () => ({}),
    disabled: false,
});

/** Form fields described by the properties of the JSON Schema */
const fields = computed<MappingField[]>(() => {
    return Object.entries(props.definition.properties).map(([key, property]) => {
        let kind: MappingField['kind'] = 'template';
        if (property.type === 'boolean') kind = 'boolean';
        else if (property.type === 'number' || property.type === 'integer') kind = 'number';
        else if (Array.isArray(property.enum)) kind = 'enum';

        return {
            key,
            kind,
            label: String(property.title ?? key),
            icon: icons[String(property['@icon'])] ?? IconTag,
            placeholder: String(property.description ?? ''),
            options: property.enum as string[] | undefined,
            default: property.default as MappingFieldValue | undefined,
        };
    });
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown>): void;
}>();

const enabled = ref<Record<string, boolean>>(Object.fromEntries(fields.value.map((f) => [f.key, false])));
const values = ref<Record<string, MappingFieldValue>>(Object.fromEntries(fields.value.map((f) => [f.key, f.default ?? ''])));

watch([enabled, values], format, { deep: true });

onMounted(() => {
    for (const field of fields.value) {
        const value = props.modelValue[field.key];
        if (value === undefined || value === null) continue;

        values.value[field.key] = value as MappingFieldValue;
        enabled.value[field.key] = true;
    }

    format();
});

function format() {
    const res: Record<string, unknown> = {};

    for (const field of fields.value) {
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
