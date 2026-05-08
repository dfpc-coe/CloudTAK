<template>
    <div class='col-12 mt-3'>
        <div class='d-flex align-items-center mb-2'>
            <label
                class='form-label mb-0'
                v-text='label'
            />

            <div
                v-if='!disabled'
                class='ms-auto'
            >
                <TablerIconButton
                    title='Add Field'
                    @click='addField'
                >
                    <IconPlus stroke='1' />
                </TablerIconButton>
            </div>
        </div>

        <TablerNone
            v-if='!fields.length'
            label='No Custom Fields'
            :compact='true'
            :create='false'
        />
        <div
            v-else
            class='table-responsive'
        >
            <table class='table card-table table-vcenter'>
                <thead>
                    <tr>
                        <th>ESRI Field</th>
                        <th>Type</th>
                        <th>JSONata Mapping</th>
                        <th v-if='!disabled' />
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='(field, fieldIndex) in fields'
                        :key='fieldIndex'
                    >
                        <td>
                            <TablerInput
                                v-model='field.name'
                                :disabled='disabled'
                                placeholder='callsign'
                            />
                        </td>
                        <td>
                            <TablerEnum
                                v-model='field.type'
                                :disabled='disabled'
                                :options='fieldTypes'
                                default='esriFieldTypeString'
                            />
                        </td>
                        <td>
                            <QueryInput
                                v-model='field.field'
                                :disabled='disabled'
                                label=''
                                placeholder='properties.callsign'
                            />
                        </td>
                        <td
                            v-if='!disabled'
                            class='w-1'
                        >
                            <TablerDelete
                                displaytype='icon'
                                @delete='removeField(fieldIndex)'
                            />
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import {
    TablerDelete,
    TablerEnum,
    TablerIconButton,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';
import { IconPlus } from '@tabler/icons-vue';
import QueryInput from './QueryInput.vue';

interface ArcGISFieldMapping {
    name: string;
    type: string;
    field: string;
}

const fieldTypes = [
    'esriFieldTypeString',
    'esriFieldTypeInteger',
    'esriFieldTypeDouble',
    'esriFieldTypeDate',
];

const props = withDefaults(defineProps<{
    modelValue?: ArcGISFieldMapping[];
    disabled?: boolean;
    label?: string;
}>(), {
    modelValue: () => [],
    disabled: true,
    label: 'Custom Fields',
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: ArcGISFieldMapping[]): void;
}>();

const fields = ref<ArcGISFieldMapping[]>(normalizeFields(props.modelValue));

watch(() => props.modelValue, (newValue) => {
    const normalized = normalizeFields(newValue);
    if (JSON.stringify(normalized) === JSON.stringify(fields.value)) return;

    fields.value = normalized;
}, { deep: true });

watch(fields, (newValue) => {
    emit('update:modelValue', normalizeFields(newValue));
}, { deep: true });

function normalizeFields(value: unknown): ArcGISFieldMapping[] {
    if (!Array.isArray(value)) return [];

    return value.map((field) => {
        const mappedField = field as Partial<ArcGISFieldMapping> | null;

        return {
            name: typeof mappedField?.name === 'string' ? mappedField.name : '',
            type: fieldTypes.includes(String(mappedField?.type)) ? String(mappedField?.type) : 'esriFieldTypeString',
            field: typeof mappedField?.field === 'string' ? mappedField.field : '',
        };
    });
}

function addField() {
    fields.value.push({
        name: '',
        type: 'esriFieldTypeString',
        field: '',
    });
}

function removeField(fieldIndex: number) {
    fields.value.splice(fieldIndex, 1);
}
</script>
