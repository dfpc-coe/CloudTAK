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
                    v-if='field.templatable'
                    v-model='templated[field.key]'
                    :disabled='disabled'
                    label='Use a template'
                />

                <HandleForm
                    v-if='templated[field.key] || field.kind === "template" || field.kind === "number"'
                    :model-value='String(values[field.key])'
                    :placeholder='field.placeholder'
                    :disabled='disabled'
                    :schema='schema'
                    @update:model-value='(v: string | number) => values[field.key] = v'
                />
                <TablerToggle
                    v-else-if='field.kind === "boolean"'
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
                <MappingChannels
                    v-else-if='field.kind === "channels"'
                    v-model='(values[field.key] as number[])'
                    :connection='Number(route.params.connectionid)'
                    :disabled='disabled'
                />
                <IconSelect
                    v-else-if='field.kind === "icon"'
                    v-model='(values[field.key] as string)'
                    label=''
                    :disabled='disabled'
                />
                <TablerInput
                    v-else-if='field.kind === "color"'
                    v-model='values[field.key]'
                    type='color'
                    :disabled='disabled'
                />
                <template v-else-if='field.kind === "objects"'>
                    <div
                        v-for='(item, index) in (values[field.key] as Array<Record<string, string>>)'
                        :key='index'
                        class='d-flex align-items-end gap-2 mb-2'
                    >
                        <div
                            v-for='column in field.items'
                            :key='column.key'
                            class='flex-grow-1'
                        >
                            <HandleForm
                                v-model='item[column.key]'
                                :label='column.label'
                                :placeholder='column.placeholder'
                                :disabled='disabled'
                                :schema='schema'
                            />
                        </div>
                        <TablerIconButton
                            title='Remove'
                            :disabled='disabled'
                            @click='(values[field.key] as unknown[]).splice(index, 1)'
                        >
                            <IconTrash
                                :size='20'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                    <button
                        class='btn btn-sm'
                        :disabled='disabled'
                        @click='(values[field.key] as unknown[]).push(Object.fromEntries((field.items ?? []).map((column) => [column.key, ""])))'
                    >
                        <IconPlus
                            :size='16'
                            stroke='1'
                        /> Add
                    </button>
                </template>

                <TablerToggle
                    v-model='update[field.key]'
                    :disabled='disabled'
                    label='Update existing records'
                    description='When disabled the value is only applied when the record is first created'
                />
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue';
import type { Component } from 'vue';
import { useRoute } from 'vue-router';
import type { CoreSchema } from '../../../../types.ts';
import HandleForm from '../../../util/HandleForm.vue';
import {
    IconTag,
    IconBox,
    IconLink,
    IconPlus,
    IconPaint,
    IconPhoto,
    IconGhost,
    IconTrash,
    IconActivity,
    IconAffiliate,
    IconCalendarEvent,
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
import { TablerEnum, TablerInput, TablerToggle, TablerIconButton } from '@tak-ps/vue-tabler';
import IconSelect from '../../../util/IconSelect.vue';
import MappingChannels from './MappingChannels.vue';

type MappingFieldValue = string | number | boolean | unknown[];
type SchemaProperty = Record<string, unknown>;

interface MappingField {
    /** Dot path of the value in the mapping object */
    key: string;
    label: string;
    icon: Component;
    placeholder: string;
    kind: 'template' | 'boolean' | 'number' | 'enum' | 'channels' | 'icon' | 'color' | 'objects';
    /** A Handlebars template can be given in place of a fixed value */
    templatable: boolean;
    options?: string[];
    items?: Array<{ key: string; label: string; placeholder: string }>;
    default: MappingFieldValue;
}

const icons: Record<string, Component> = {
    IconTag,
    IconBox,
    IconLink,
    IconPaint,
    IconPhoto,
    IconGhost,
    IconActivity,
    IconAffiliate,
    IconCalendarEvent,
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

/** Form fields described by the properties of the JSON Schema - nested objects become dot paths */
function schemaFields(properties: Record<string, SchemaProperty>, prefix = ''): MappingField[] {
    return Object.entries(properties).flatMap(([name, property]): MappingField[] => {
        const key = `${prefix}${name}`;

        if (property.type === 'object') return schemaFields(property.properties as Record<string, SchemaProperty>, `${key}.`);

        const field: MappingField = {
            key,
            kind: 'template',
            templatable: false,
            label: String(property.title ?? name),
            icon: icons[String(property['@icon'])] ?? IconTag,
            placeholder: String(property.description ?? ''),
            default: (property.default ?? '') as MappingFieldValue,
        };

        const items = property.items as SchemaProperty | undefined;

        if (property['@widget'] === 'channels' || property['@widget'] === 'icon' || property['@widget'] === 'color') {
            field.kind = property['@widget'];
            if (field.kind === 'channels') field.default = [];
            if (field.kind === 'color') field.default = '#d63939';
        } else if (property.type === 'boolean') {
            field.kind = 'boolean';
            field.templatable = true;
            field.default = property.default === true;
        } else if (property.type === 'number' || property.type === 'integer') {
            field.kind = 'number';
        } else if (Array.isArray(property.enum)) {
            field.kind = 'enum';
            field.templatable = true;
            field.options = property.enum as string[];
        } else if (property.type === 'array' && items?.type === 'object') {
            field.kind = 'objects';
            field.default = [];
            field.items = Object.entries(items.properties as Record<string, SchemaProperty>).map(([item, def]) => ({
                key: item,
                label: String(def.title ?? item),
                placeholder: String(def.description ?? ''),
            }));
        } else if (property.type === 'array') {
            // Arrays without a widget can't be edited
            return [];
        }

        return [field];
    });
}

const fields = computed(() => schemaFields(props.definition.properties));

function isTemplate(value: unknown): boolean {
    return typeof value === 'string' && value.includes('{{');
}

function getPath(obj: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, part) => {
        return current !== null && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined;
    }, obj);
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts.slice(0, -1)) {
        if (current[part] === null || typeof current[part] !== 'object') current[part] = {};
        current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
}

const route = useRoute();

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown>): void;
}>();

const enabled = ref<Record<string, boolean>>(Object.fromEntries(fields.value.map((f) => [f.key, false])));
const update = ref<Record<string, boolean>>(Object.fromEntries(fields.value.map((f) => [f.key, true])));
const templated = ref<Record<string, boolean>>(Object.fromEntries(fields.value.map((f) => [f.key, false])));
const values = ref<Record<string, MappingFieldValue>>(Object.fromEntries(fields.value.map((f) => [f.key, structuredClone(f.default)])));

watch([enabled, update, values], format, { deep: true });

// A fixed value can't be shown by the template input & a template can't be shown by the fixed input
watch(templated, (current) => {
    for (const field of fields.value) {
        if (!field.templatable || current[field.key] === isTemplate(values.value[field.key])) continue;
        values.value[field.key] = current[field.key] ? '' : structuredClone(field.default);
    }
}, { deep: true });

onMounted(() => {
    for (const field of fields.value) {
        let value = getPath(props.modelValue, field.key);

        // A field is either its bare value or { value, update }
        if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
            update.value[field.key] = (value as { update?: boolean }).update !== false;
            value = value.value;
        }

        if (value === undefined || value === null) continue;

        values.value[field.key] = structuredClone(value) as MappingFieldValue;
        templated.value[field.key] = field.templatable && isTemplate(value);
        enabled.value[field.key] = true;
    }

    format();
});

function format() {
    const res: Record<string, unknown> = {};

    for (const field of fields.value) {
        if (!enabled.value[field.key]) continue;

        let value = values.value[field.key];
        if (field.kind === 'number' && value !== '' && !isNaN(Number(value))) value = Number(value);

        setPath(res, field.key, update.value[field.key] ? value : { value, update: false });
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
