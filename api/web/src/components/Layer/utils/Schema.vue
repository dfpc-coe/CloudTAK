<template>
<div v-if='data' class='px-2 py-2'>
    <div :key='key' v-for='key in Object.keys(schema.properties)' class='py-2 floating-input'>
        <template v-if='schema.properties[key].enum'>
            <TablerEnum
                :label='key'
                :disabled='disabled'
                v-model='data[key]'
                :options='schema.properties[key].enum'
                :default='schema.properties[key].default'
            />
        </template>
        <template v-else-if='schema.properties[key].type === "string"'>
            <TablerInput
                :label='key'
                :disabled='disabled'
                v-model='data[key]'
                :default='schema.properties[key].default'
            />
        </template>
        <template v-else-if='schema.properties[key].type === "boolean"'>
            <TablerToggle
                :label='key'
                :disabled='disabled'
                v-model='data[key]'
                :default='schema.properties[key].default'
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
                <label class='form-label' v-text='key'/>
                <div class='ms-auto' v-if='!disabled'>
                    <IconTrash v-tooltip='"Clear Table"' @click='this.data[key].splice(0, this.data[key].length)' size='32' class='cursor-pointer'/>
                    <IconDatabaseImport v-tooltip='"Import CSV"' @click='importModal(Object.keys(schema.properties[key].items.properties), data[key])' size='32' class='cursor-pointer'/>
                    <IconPlus v-tooltip='"Add Row"' @click='editModal(schema.properties[key].items, {}, key)' size='32' class='cursor-pointer'/>
                </div>
            </div>
            <template v-if='schema.properties[key].items.type === "object" && schema.properties[key].items.properties'>
                <div class='table-responsive'>
                    <table class="table table-hover card-table table-vcenter border rounded cursor-pointer">
                        <thead>
                            <tr>
                                <th :key='prop' v-for='prop in Object.keys(schema.properties[key].items.properties)'>
                                    <span v-text='prop'/>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr @click='editModal(schema.properties[key].items, arr, key, i)' :key='i' v-for='(arr, i) in data[key]'>
                                <template v-if='disabled'>
                                    <td :key='prop' v-for='prop in Object.keys(schema.properties[key].items.properties)'>
                                        <span v-text='arr[prop]'/>
                                    </td>
                                </template>
                                <template v-else>
                                    <td :key='prop' v-for='(prop, prop_it) in Object.keys(schema.properties[key].items.properties)'>
                                        <span v-text='arr[prop]'/>
                                    </td>
                                </template>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </template>
            <template v-else>
                <div :key='i' v-for='(arr, i) of data[key]' class='border rounded my-2 py-2 mx-2 px-2'>
                    <div class='d-flex'>
                        <div class='mx-2 my-2'>Entry <span v-text='i + 1'/></div>
                        <div class='ms-auto mx-2 my-2'>
                            <IconTrash v-if='!disabled' @click='data[key].splice(i, 1)' size='32' class='cursor-pointer'/>
                        </div>
                    </div>

                    <TablerSchema
                        :schema='schema.properties[key].items'
                        :disabled='disabled'
                        v-model='data[key][i]'
                    />
                </div>
            </template>
        </template>
        <template v-else>
            <div class='row'>
                <TablerInput :label='key' :rows='3' :disabled='disabled' v-model='data[key]'/>
            </div>
        </template>
    </div>

    <UploadCSV v-if='upload.shown' @close='upload.shown = false' @import='importCSV($event)'/>

    <SchemaModal
        v-if='edit.shown !== false'
        :allowDelete='!isNaN(edit.i) && !disabled'
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
    TablerInput,
    TablerToggle,
    TablerSchema,
    TablerEnum
} from '@tak-ps/vue-tabler';
import UploadCSV from '../../util/UploadCSV.vue';
import SchemaModal from './SchemaModal.vue';
import {
    IconPlus,
    IconTrash,
    IconCheck,
    IconPencil,
    IconDatabaseImport,
} from '@tabler/icons-vue'

export default {
    name: 'LayerSchema',
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
                if (!this.schema.properties[key].default) {
                    if (!this.data[key] && this.schema.properties[key].type === 'array') {
                        this.data[key] = [];
                    } else if (!this.data[key] && this.schema.properties[key].type === 'boolean') {
                        this.data[key] = false;
                    } else if (!this.data[key] && this.schema.properties[key].type === 'string') {
                        this.data[key] = '';
                    }
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

            for (const line of csv.split('\n')) {
                const row = line.split('\t');
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
    },
    components: {
        IconPlus,
        IconPencil,
        IconDatabaseImport,
        IconTrash,
        IconCheck,
        TablerInput,
        TablerToggle,
        TablerEnum,
        TablerSchema,
        UploadCSV,
        SchemaModal,
    }
}
</script>
