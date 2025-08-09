<template>
    <div
        v-if='data'
        class='px-2 py-2'
    >
        <div
            v-for='key in Object.keys(schema.properties)'
            :key='key'
            class='py-2 floating-input'
        >
            <template v-if='schema.properties[key].enum'>
                <TablerEnum
                    v-model='data[key]'
                    :label='key'
                    :disabled='disabled'
                    :options='schema.properties[key].enum'
                    :default='schema.properties[key].default'
                    :required='schema.required.includes(key)'
                    :description='schema.properties[key].description'
                />
            </template>
            <template v-else-if='schema.properties[key].type === "string"'>
                <TablerInput
                    v-model='data[key]'
                    :label='key'
                    :disabled='disabled'
                    :default='schema.properties[key].default'
                    :required='schema.required.includes(key)'
                    :description='schema.properties[key].description'
                />
            </template>
            <template v-else-if='schema.properties[key].type === "number" || schema.properties[key].type === "integer"'>
                <TablerInput
                    v-model='data[key]'
                    type='number'
                    :label='key'
                    :step='schema.properties[key].type === "integer" ? 1 : "any"'
                    :disabled='disabled'
                    :default='schema.properties[key].default'
                    :required='schema.required.includes(key)'
                    :description='schema.properties[key].description'
                />
            </template>
            <template v-else-if='schema.properties[key].type === "boolean"'>
                <TablerToggle
                    v-model='data[key]'
                    :label='key'
                    :disabled='disabled'
                    :default='schema.properties[key].default'
                    :required='schema.required.includes(key)'
                    :description='schema.properties[key].description'
                />
            </template>
            <template
                v-else-if='
                    schema.properties[key].type === "array"
                        && schema.properties[key].items.type === "object"
                        && schema.properties[key].items.properties
                '
            >
                <div class='d-flex'>
                    <label
                        class='form-label'
                        v-text='key'
                    />
                    <span
                        v-if='schema.required.includes(key)'
                        class='text-red mx-1'
                    >*</span>
                    <div
                        v-if='!disabled'
                        class='ms-auto'
                    >
                        <IconTrash
                            v-tooltip='"Clear Table"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='data[key].splice(0, data[key].length)'
                        />
                        <IconDatabaseImport
                            v-tooltip='"Import CSV"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='importModal(Object.keys(schema.properties[key].items.properties), data[key])'
                        />
                        <IconPlus
                            v-tooltip='"Add Row"'
                            :size='32'
                            stroke='1'
                            class='cursor-pointer'
                            @click='editModal(schema.properties[key].items, {}, key)'
                        />
                    </div>
                </div>
                <template v-if='schema.properties[key].items.type === "object" && schema.properties[key].items.properties'>
                    <div class='table-responsive'>
                        <table class='table table-hover card-table table-vcenter border rounded cursor-pointer'>
                            <thead>
                                <tr>
                                    <th
                                        v-for='prop in Object.keys(schema.properties[key].items.properties)'
                                        :key='prop'
                                    >
                                        <span v-text='prop' />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for='(arr, i) in data[key]'
                                    :key='i'
                                    @click='editModal(schema.properties[key].items, arr, key, i)'
                                >
                                    <template v-if='disabled'>
                                        <td
                                            v-for='prop in Object.keys(schema.properties[key].items.properties)'
                                            :key='prop'
                                        >
                                            <span v-text='arr[prop]' />
                                        </td>
                                    </template>
                                    <template v-else>
                                        <td
                                            v-for='prop in Object.keys(schema.properties[key].items.properties)'
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
                        v-if='!data[key] || !data[key].length'
                        :label='key'
                        :create='!disabled'
                        @create='editModal(schema.properties[key].items, {}, key)'
                    />
                </template>
                <template v-else>
                    <div
                        v-for='(arr, i) of data[key]'
                        :key='i'
                        class='border rounded my-2 py-2 mx-2 px-2'
                    >
                        <div class='d-flex'>
                            <div class='mx-2 my-2'>
                                Entry <span v-text='i + 1' />
                            </div>
                            <div class='ms-auto mx-2 my-2'>
                                <IconTrash
                                    v-if='!disabled'
                                    :size='32'
                                    stroke='1'
                                    class='cursor-pointer'
                                    @click='data[key].splice(i, 1)'
                                />
                            </div>
                        </div>

                        <TablerSchema
                            v-model='data[key][i]'
                            :schema='schema.properties[key].items'
                            :disabled='disabled'
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
                        :disabled='disabled'
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
            v-if='edit.shown !== false'
            :allow-delete='!isNaN(edit.i) && !disabled'
            :edit='edit.row'
            :disabled='disabled'
            :schema='edit.schema'
            @remove='editModalRemove'
            @done='editModalDone($event)'
            @close='edit.shown = false'
        />
    </div>
</template>

<script>
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

export default {
    name: 'LayerSchema',
    components: {
        IconPlus,
        IconDatabaseImport,
        IconTrash,
        TablerNone,
        TablerInput,
        TablerToggle,
        TablerEnum,
        TablerSchema,
        UploadCSV,
        SchemaModal,
    },
    props: {
        modelValue: {
            type: Object,
            required: true
        },
        schema: {
            type: Object,
            required: true
        },
        disabled: {
            type: Boolean,
            default: false
        }
    },
    emits: [
        'update:modelValue'
    ],
    data: function() {
        return {
            data: false,
            edit: {
                id: false,
                key: false,
                shown: false,
                data: false,
                schema: false
            },
            upload: {
                headers: [],
                data: null,
                shown: false
            }
        };
    },
    watch: {
        data: {
            deep: true,
            handler: function() {
                this.$emit('update:modelValue', this.data);
            }
        },
    },
    mounted: async function() {
        this.data = JSON.parse(JSON.stringify(this.modelValue));

        if (this.schema.type === 'object' && this.schema.properties) {
            for (const key in this.schema.properties) {
                if (!this.data[key] && this.schema.properties[key].type === 'array') {
                    this.data[key] = this.schema.properties[key].default || [];
                } else if (!this.data[key] && this.schema.properties[key].type === 'boolean') {
                    this.data[key] = this.schema.properties[key].default || false;
                } else if (!this.data[key] && this.schema.properties[key].type === 'string') {
                    this.data[key] = this.schema.properties[key].default || '';
                } else if (!this.data[key] && this.schema.properties[key].type === 'integer') {
                    this.data[key] = this.schema.properties[key].default;
                } else if (!this.data[key] && this.schema.properties[key].type === 'number') {
                    this.data[key] = this.schema.properties[key].default;
                }
            }
        }
    },
    methods: {
        importModal: function(headers, data) {
            this.upload.headers = headers;
            this.upload.data = data;
            this.upload.shown = true;
        },
        importCSV: function(csv) {
            this.upload.shown = false;

            // Auto-detect delimiter: prefer comma, fallback to tab for backward compatibility
            const firstLine = csv.split('\n')[0];
            const delimiter = firstLine.includes(',') ? ',' : '\t';

            for (const line of csv.split('\n')) {
                const row = line.split(delimiter);
                const obj = {};
                for (let i = 0; i < this.upload.headers.length; i++) {
                    obj[this.upload.headers[i]] = row[i]
                }
                this.upload.data.push(obj);
            }
        },
        editModalRemove: function() {
            if (!isNaN(this.edit.id)) this.data[this.edit.key].splice(this.edit.id, 1)
            this.edit.shown = false;
        },
        editModalDone: function(row) {
            if (this.edit.id) {
                this.data[this.edit.key][this.edit.id] = row;
            } else {
                this.data[this.edit.key].push(row);
            }

            this.edit.shown = false;
        },
        editModal: function(schema, row, key, id) {
            this.edit = {
                shown: true,
                key,
                row,
                schema,
                id: id ?? null
            }
        },
        push: function(key) {
            if (!this.schema.properties[key].items) this.data[key].push('');
            if (this.schema.properties[key].items.type === 'object') {
                const obj = {};
                this.data[key].push(obj);
            } else if (this.schema.properties[key].items.type === 'array') {
                this.data[key].push([]);
            } else if (this.schema.properties[key].items.type === 'boolean') {
                this.data[key].push(false);
            } else {
                this.data[key].push('');
            }
        }
    }
}
</script>
