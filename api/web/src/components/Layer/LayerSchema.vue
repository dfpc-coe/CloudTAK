<template>
<div>
    <div class='card-header'>
        <h3 class='card-title'>Layer Schema</h3>

        <div class='ms-auto btn-list'>
            <PlusIcon v-if='!disabled' v-tooltip='"Manual Addition"' @click='create = true' class='cursor-pointer'/>
            <WorldDownloadIcon v-if='!disabled' v-tooltip='"Automated Schema"' @click='fetchSchema' class='cursor-pointer'/>
            <SettingsIcon @click='disabled = false' class='cursor-pointer'/>
        </div>
    </div>

    <TablerLoading v-if='loading.schema' desc='Retrieving Schema'/>
    <TablerLoading v-else-if='loading.save' desc='Saving Schema'/>
    <TablerNone v-else-if='!schema.length' label='Schema' :create='false'/>
    <div v-else class='table-responsive'>
        <table class="table table-hover card-table table-vcenter" :class='{
            "cursor-pointer": !disabled
        }'>
            <thead>
                <tr>
                    <th>Property Name</th>
                    <th>Type</th>
                    <th>Attributes</th>
                </tr>
            </thead>
            <tbody>
                <tr @click='edit(field)' :key='field.name' v-for='(field, field_it) in schema'>
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
                        <div class='d-flex'>
                            <span v-if='field.required' class='badge mx-1 mb-1 bg-red text-white'>Required</span>
                            <div class='ms-auto'>
                                <TrashIcon v-if='!disabled' @click.stop='schema.splice(field_it, 1)' class='cursor-pointer'/>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        <div v-if='!disabled' class="col-12 px-2 py-2 d-flex">
            <button @click='processModelValue(layer.schema, true)' class='btn'>Cancel</button>
            <div class='ms-auto'>
                <button @click='saveLayer' class='btn btn-primary'>Save</button>
            </div>
        </div>
    </div>

    <LayerSchemaModal
        v-if='create'
        :edit='editField'
        :schema='schema'
        @done='push($event)'
        @close='create = false'
    />
</div>
</template>

<script>
import LayerSchemaModal from './utils/LayerSchemaModal.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
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
    BinaryIcon,
    TrashIcon,
    WorldDownloadIcon,
} from 'vue-tabler-icons'

export default {
    name: 'LayerSchema',
    props: {
        layer: {
            type: Object,
            required: true
        },
    },
    data: function() {
        return {
            disabled: true,
            loading: {
                schema: false
            },
            create: false,
            editField: null,
            schema: []
        };
    },
    mounted: function() {
        this.processModelValue(this.layer.schema);
    },
    methods: {
        edit: function(field) {
            if (this.disabled) return;
            this.editField = field;
            this.create = true;
        },
        push: function(field) {
            this.create = false;
            if (this.editField) {
                this.editField = Object.assign(this.editField, field);
            } else {
                this.schema.push(field);
            }
            this.editField = null;
        },
        saveLayer: async function() {
            this.loading.save = true;

            const required = []
            const properties = {};

            for (const field of this.schema) {
                const name = field.name;
                delete field.name;

                if (field.required) required.push(name);
                delete field.required;

                properties[name] = {
                    ...field
                }
            }

            const layer = await window.std(`/api/layer/${this.$route.params.layerid}`, {
                method: 'PATCH',
                body: {
                    schema: {
                        type: 'object',
                        required,
                        additionalProperties: false,
                        properties
                    }
                }
            });

            this.loading.save = false;

            this.$emit('layer', layer);
        },
        fetchSchema: async function() {
            this.loading.schema = true;
            const url = window.stdurl(`/api/layer/${this.$route.params.layerid}/task/schema`);
            url.searchParams.append('type', 'schema:output');
            const schema = await window.std(url);

            this.processModelValue(schema.schema)
            this.loading.schema = false;
        },
        processModelValue: function(modelValue, disable = false) {
            this.schema.splice(0, this.schema.length);

            if (!modelValue) return;

            for (const name in modelValue.properties) {
                this.schema.push({
                    name,
                    required: modelValue.required.includes(name),
                    ...modelValue.properties[name]
                });
            }

            if (disable) this.disabled = true;
        }
    },
    components: {
        TablerNone,
        AlphabetLatinIcon,
        Sort09Icon,
        DecimalIcon,
        TablerInput,
        TablerToggle,
        TablerEnum,
        TablerLoading,
        PlusIcon,
        RefreshIcon,
        SettingsIcon,
        BinaryIcon,
        LayerSchemaModal,
        TrashIcon,
        WorldDownloadIcon,
    }
}
</script>
