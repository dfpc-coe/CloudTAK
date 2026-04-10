<template>
    <div
        v-if='data'
        class='px-2 py-2'
    >
        <div
            v-for='key in Object.keys(props.schema.properties)'
            :key='key'
            class='py-2 floating-input'
        >
            <template v-if='props.schema.properties[key].enum'>
                <TablerEnum
                    v-model='data[key]'
                    :label='key'
                    :disabled='props.disabled'
                    :options='props.schema.properties[key].enum'
                    :default='props.schema.properties[key].default'
                    :required='props.schema.required.includes(key)'
                    :description='props.schema.properties[key].description'
                />
            </template>
            <template v-else-if='props.schema.properties[key].type === "string"'>
                <TablerInput
                    v-model='data[key]'
                    :label='key'
                    :disabled='props.disabled'
                    :default='props.schema.properties[key].default'
                    :required='props.schema.required.includes(key)'
                    :description='props.schema.properties[key].description'
                />
            </template>
            <template v-else-if='props.schema.properties[key].type === "number" || props.schema.properties[key].type === "integer"'>
                <TablerInput
                    v-model='data[key]'
                    type='number'
                    :label='key'
                    :step='props.schema.properties[key].type === "integer" ? 1 : "any"'
                    :disabled='props.disabled'
                    :default='props.schema.properties[key].default'
                    :required='props.schema.required.includes(key)'
                    :description='props.schema.properties[key].description'
                />
            </template>
            <template v-else-if='props.schema.properties[key].type === "boolean"'>
                <TablerToggle
                    v-model='data[key]'
                    :label='key'
                    :disabled='props.disabled'
                    :default='props.schema.properties[key].default'
                    :required='props.schema.required.includes(key)'
                    :description='props.schema.properties[key].description'
                />
            </template>
            <template
                v-else-if='
                    props.schema.properties[key].type === "array"
                        && props.schema.properties[key].items.type === "object"
                        && props.schema.properties[key].items.properties
                '
            >
                <div class='d-flex'>
                    <label
                        class='form-label'
                        v-text='key'
                    />
                    <span
                        v-if='props.schema.required.includes(key)'
                        class='text-red mx-1'
                    >*</span>
                    <div
                        v-if='!props.disabled'
                        class='ms-auto'
                    >
                        <IconTrash
                            v-tooltip='"Clear Table"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='(data[key] as unknown[]).splice(0, (data[key] as unknown[]).length)'
                        />
                        <IconDatabaseImport
                            v-tooltip='"Import CSV"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='importModal(Object.keys(props.schema.properties[key].items.properties), data[key] as Record<string, unknown>[])'
                        />
                        <IconPlus
                            v-tooltip='"Add Row"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='editModal(props.schema.properties[key].items, {}, key)'
                        />
                    </div>
                </div>
                <template v-if='props.schema.properties[key].items.type === "object" && props.schema.properties[key].items.properties'>
                    <div class='table-responsive'>
                        <table class='table table-hover card-table table-vcenter border rounded cursor-pointer'>
                            <thead>
                                <tr>
                                    <th
                                        v-for='prop in Object.keys(props.schema.properties[key].items.properties)'
                                        :key='prop'
                                    >
                                        <span v-text='prop' />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for='(arr, i) in (data[key] as Record<string, unknown>[])'
                                    :key='i'
                                    @click='editModal(props.schema.properties[key].items, arr, key, i)'
                                >
                                    <template v-if='props.disabled'>
                                        <td
                                            v-for='prop in Object.keys(props.schema.properties[key].items.properties)'
                                            :key='prop'
                                        >
                                            <span v-text='arr[prop]' />
                                        </td>
                                    </template>
                                    <template v-else>
                                        <td
                                            v-for='prop in Object.keys(props.schema.properties[key].items.properties)'
                                            :key='prop'
                                        >
                                            <span v-text='arr[prop]' />
                                        </td>
                                    </template>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <TablerNone
                        v-if='!data[key] || !(data[key] as unknown[]).length'
                        :label='key'
                        :create='!props.disabled'
                        @create='editModal(props.schema.properties[key].items, {}, key)'
                    />
                </template>
                <template v-else>
                    <div
                        v-for='(arr, i) of (data[key] as unknown[])'
                        :key='i'
                        class='border rounded my-2 py-2 mx-2 px-2'
                    >
                        <div class='d-flex'>
                            <div class='mx-2 my-2'>
                                Entry <span v-text='i + 1' />
                            </div>
                            <div class='ms-auto mx-2 my-2'>
                                <IconTrash
                                    v-if='!props.disabled'
                                    :size='32'
                                    stroke='1'
                                    class='cursor-pointer'
                                    @click='(data[key] as unknown[]).splice(i, 1)'
                                />
                            </div>
                        </div>

                        <TablerSchema
                            v-model='(data[key] as Record<string, unknown>[])[i]'
                            :schema='props.schema.properties[key].items'
                            :disabled='props.disabled'
                        />
                    </div>
                </template>
            </template>
            <template v-else>
                <div class='row'>
                    <TablerInput
                        v-model='data[key]'
                        :label='key'
                        :rows='3'
                        :disabled='props.disabled'
                    />
                </div>
            </template>
        </div>

        <UploadCSV
            v-if='upload.shown'
            @close='upload.shown = false'
            @import='importCSV($event)'
        />

        <SchemaModal
            v-if='edit.shown && edit.schema'
            :allow-delete='edit.id !== null && !props.disabled'
            :edit='edit.row'
            :disabled='props.disabled'
            :schema='edit.schema'
            @remove='editModalRemove'
            @done='editModalDone($event)'
            @close='edit.shown = false'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, reactive, watch, onMounted } from 'vue';
import {
    TablerNone,
    TablerInput,
    TablerToggle,
    TablerSchema,
    TablerEnum
} from '@tak-ps/vue-tabler';
import UploadCSV from '../../../util/UploadCSV.vue';
import SchemaModal from './SchemaModal.vue';
import {
    IconPlus,
    IconTrash,
    IconDatabaseImport,
} from '@tabler/icons-vue'

interface SchemaProperty {
    type?: string;
    enum?: string[];
    default?: unknown;
    description?: string;
    items: SchemaDefinition;
    [key: string]: unknown;
}

interface SchemaDefinition {
    type?: string;
    required: string[];
    properties: Record<string, SchemaProperty>;
    [key: string]: unknown;
}

const props = withDefaults(defineProps<{
    modelValue: Record<string, unknown>;
    schema: SchemaDefinition;
    disabled?: boolean;
}>(), {
    disabled: false
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: Record<string, unknown>): void;
}>();

const data = ref<Record<string, unknown> | false>(false);
const edit = reactive<{
    id: number | null;
    key: string;
    shown: boolean;
    row: Record<string, unknown>;
    schema: SchemaDefinition | false;
}>({
    id: null,
    key: '',
    shown: false,
    row: {},
    schema: false
});
const upload = reactive<{
    headers: string[];
    data: Record<string, unknown>[] | null;
    shown: boolean;
}>({
    headers: [],
    data: null,
    shown: false
});

watch(data, () => {
    if (data.value !== false) emit('update:modelValue', data.value);
}, {
    deep: true
});

onMounted(() => {
    data.value = JSON.parse(JSON.stringify(props.modelValue));

    if (props.schema.type === 'object' && props.schema.properties) {
        for (const key in props.schema.properties) {
            const d = data.value as Record<string, unknown>;
            const prop = props.schema.properties[key];
            if (d[key] === undefined && prop.type === 'array') {
                d[key] = prop.default || [];
            } else if (d[key] === undefined && prop.type === 'boolean') {
                d[key] = prop.default || false;
            } else if (d[key] === undefined && prop.type === 'string') {
                d[key] = prop.default || '';
            } else if (d[key] === undefined && prop.type === 'integer') {
                d[key] = prop.default;
            } else if (d[key] === undefined && prop.type === 'number') {
                d[key] = prop.default;
            }
        }
    }
});

function importModal(headers: string[], targetData: Record<string, unknown>[]) {
    upload.headers = headers;
    upload.data = targetData;
    upload.shown = true;
}

function importCSV(csv: string) {
    upload.shown = false;

    const firstLine = csv.split('\n')[0];
    const delimiter = firstLine.includes(',') ? ',' : '\t';

    for (const line of csv.split('\n')) {
        const row = line.split(delimiter);
        const obj: Record<string, string> = {};
        for (let i = 0; i < upload.headers.length; i++) {
            obj[upload.headers[i]] = row[i]
        }
        if (upload.data) upload.data.push(obj);
    }
}

function editModalRemove() {
    if (edit.id !== null && data.value) {
        const arr = data.value[edit.key];
        if (Array.isArray(arr)) arr.splice(edit.id, 1);
    }
    edit.shown = false;
}

function editModalDone(row: Record<string, unknown>) {
    if (data.value) {
        const arr = data.value[edit.key];
        if (Array.isArray(arr)) {
            if (edit.id !== null) {
                arr[edit.id] = row;
            } else {
                arr.push(row);
            }
        }
    }

    edit.shown = false;
}

function editModal(schema: SchemaDefinition, row: Record<string, unknown>, key: string, id?: number) {
    edit.shown = true;
    edit.key = key;
    edit.row = row;
    edit.schema = schema;
    edit.id = id ?? null;
}
</script>

