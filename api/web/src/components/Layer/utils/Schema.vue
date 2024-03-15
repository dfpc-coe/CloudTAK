<template>
<div class='px-2 py-2'>
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
        <template v-else-if='schema.properties[key].type === "array"'>
            <div class='d-flex'>
                <label class='form-label' v-text='key'/>
                <div class='ms-auto'>
                    <IconTrash v-if='!disabled && schema.properties[key].display === "table" && schema.properties[key].items.properties' @click='this.data[key].splice(0, this.data[key].length)' size='32' class='cursor-pointer'/>
                    <IconDatabaseImport v-if='!disabled && schema.properties[key].display === "table" && schema.properties[key].items.properties' @click='importModal(Object.keys(schema.properties[key].items.properties), data[key])' size='32' class='cursor-pointer'/>
                    <IconPlus v-if='!disabled' @click='push(key)' size='32' class='cursor-pointer'/>
                </div>
            </div>

            <template v-if='schema.properties[key].display === "table" && schema.properties[key].items.properties'>
                <div class='table-responsive'>
                <table class="table card-table table-vcenter border rounded">
                    <thead>
                        <tr>
                            <th :key='prop' v-for='prop in Object.keys(schema.properties[key].items.properties)' v-text='prop'></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr :key='i' v-for='(arr, i) in data[key]'>
                            <template v-if='disabled'>
                                <td :key='prop' v-for='prop in Object.keys(schema.properties[key].items.properties)' v-text='arr[prop]'></td>
                            </template>
                            <template v-else>
                                <td :key='prop' v-for='(prop, prop_it) in Object.keys(schema.properties[key].items.properties)'>
                                    <template v-if='edit[key].has(arr)'>
                                        <template v-if='prop_it === Object.keys(schema.properties[key].items.properties).length - 1'>
                                            <div class='d-flex'>
                                                <div clas='w-full'>
                                                    <TablerInput v-model='arr[prop]' class='w-full'/>
                                                </div>
                                                <div class='ms-auto btn-list' style='padding-left: 12px;'>
                                                    <IconCheck @click='removeEdit(key, arr, i)' size='32' class='my-1 cursor-pointer'/>
                                                    <IconTrash @click='remove(key, arr, i)' size='32' class='my-1 cursor-pointer'/>
                                                </div>
                                            </div>
                                        </template>
                                        <template v-else>
                                            <TablerInput v-model='arr[prop]'/>
                                        </template>
                                    </template>
                                    <template v-else>
                                        <template v-if='prop_it === Object.keys(schema.properties[key].items.properties).length - 1'>
                                            <div class='d-flex'>
                                                <span v-text='arr[prop]' class='w-full'/>
                                                <div class='ms-auto' style='padding-left: 12px;'>
                                                    <IconPencil @click='edit[key].set(arr, true)' size='32' class='my-1 cursor-pointer'/>
                                                </div>
                                            </div>
                                        </template>
                                        <template v-else>
                                            <span v-text='arr[prop]'/>
                                        </template>
                                    </template>
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

                    <Schema
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
</div>
</template>

<script>
import {
    TablerInput,
    TablerToggle,
    TablerEnum
} from '@tak-ps/vue-tabler';
import UploadCSV from '../../util/UploadCSV.vue';
import {
    IconPlus,
    IconTrash,
    IconCheck,
    IconPencil,
    IconDatabaseImport,
} from '@tabler/icons-vue'

export default {
    name: 'Schema',
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
            data: {},
            edit: {},
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

        for (const key of Object.keys(this.schema.properties)) {
            if (this.schema.properties[key].display === 'table') {
                this.edit[key] = new Map();
            }
        }

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
        removeEdit: function(key, arr) {
            this.edit[key].delete(arr);
        },
        remove: function(key, arr, i) {
            this.edit[key].delete(arr);
            this.data[key].splice(i, 1)
        },
        push: function(key) {
            if (!this.schema.properties[key].items) this.data[key].push('');
            if (this.schema.properties[key].items.type === 'object') {
                const obj = {};
                this.data[key].push(obj);
                if (!this.edit[key]) this.edit[key] = new Map();
                this.edit[key].set(obj, true);
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
        UploadCSV
    }
}
</script>
