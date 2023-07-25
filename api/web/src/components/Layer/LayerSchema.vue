<template>
<div class='card'>
    <div class='card-header'>
        <h3 class='card-title'>Layer Schema</h3>

        <div class='ms-auto btn-list'>
            <PlusIcon v-if='!disabled' @click='create = true' class='cursor-pointer'/>
        </div>
    </div>

    <None v-if='!schema.length' :compact='true' label='Schema' :create='false'/>
    <div v-else class='table-responsive'>
        <table class="table table-hover card-table table-vcenter cursor-pointer">
            <thead>
                <tr>
                    <th>Property Name</th>
                    <th>Type</th>
                    <th>Attributes</th>
                </tr>
            </thead>
            <tbody>
                <tr @click='edit(field)' :key='field.name' v-for='field in schema'>
                    <td>
                        <span class='mx-3'>
                            <template v-if='field.type === "string"'>
                                <AlphabetLatinIcon/>
                            </template>
                            <template v-else-if='field.type === "number"'>
                                <DecimalIcon/>
                            </template>
                            <template v-else-if='field.type === "integer"'>
                                <Sort09Icon/>
                            </template>
                            <template v-else>
                                <BinaryIcon/>
                            </template>
                        </span>
                        <span v-text='field.name'/>
                    </td>
                    <td>
                        <span v-text='field.type'/>
                    </td>
                    <td>
                        <span v-if='field.required' class='badge mx-1 mb-1 bg-red'>Required</span>
                    </td>
                </tr>
            </tbody>
        </table>
        <div :key='field.name' v-for='field of schema' class='col-12'>
        </div>
    </div>

    <LayerSchemaModal
        v-if='create'
        :edit='editField'
        @done='push($event)'
        @close='create = false'
    />
</div>
</template>

<script>
import None from '../cards/None.vue';
import LayerSchemaModal from './LayerSchemaModal.vue';
import {
    TablerInput,
    TablerToggle,
    TablerEnum,
} from '@tak-ps/vue-tabler';
import {
    AlphabetLatinIcon,
    Sort09Icon,
    PlusIcon,
    RefreshIcon,
    SettingsIcon,
    DecimalIcon,
    BinaryIcon
} from 'vue-tabler-icons'

export default {
    name: 'LayerSchema',
    props: {
        modelValue: {
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
            create: false,
            editField: null,
            schema: []
        };
    },
    watch: {
        modelValue: {
            deep: true,
            handler: function() {
                this.processModalValue();
            }
        },
        schema: {
            deep: true,
            handler: function() {
                //this.$emit('update:modelValue', this.schema);
            }
        }
    },
    mounted: function() {
    },
    methods: {
        edit: function(field) {
            this.editField = field;
            this.create = true;
        },
        push: function(field) {
            if (this.editField) {
                this.editField = Object.assign(this.editField, field);
            } else {
                this.schema.push(field);
            }
            this.create = false;
            this.editField = null;
        },
        processModalValue: function() {
            this.schema.splice(0, this.schema.length);

            if (!this.modelValue) return;
            for (const name in this.modalValue.properties) {
                this.schema.push({
                    name,
                    required: this.modalValue.required.includes(key),
                    ...this.modalValue.properties.type
                });
            }
        }
    },
    components: {
        None,
        AlphabetLatinIcon,
        Sort09Icon,
        DecimalIcon,
        TablerInput,
        TablerToggle,
        TablerEnum,
        PlusIcon,
        RefreshIcon,
        SettingsIcon,
        BinaryIcon,
        LayerSchemaModal
    }
}
</script>
