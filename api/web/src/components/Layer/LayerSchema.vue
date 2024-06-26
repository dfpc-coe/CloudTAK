<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Layer Schema
            </h3>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-if='!disabled'
                    v-tooltip='"Manual Addition"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='create = true'
                />
                <IconWorldDownload
                    v-if='!disabled'
                    v-tooltip='"Automated Schema"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetchSchema'
                />
                <IconSettings
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='disabled = false'
                />
            </div>
        </div>

        <TablerLoading
            v-if='loading.schema'
            desc='Retrieving Schema'
        />
        <TablerLoading
            v-else-if='loading.save'
            desc='Saving Schema'
        />
        <TablerNone
            v-else-if='!schema.length && disabled'
            label='Schema'
            :create='false'
        />
        <div
            v-else
            class='table-responsive'
        >
            <table
                class='table table-hover card-table table-vcenter'
                :class='{
                    "cursor-pointer": !disabled
                }'
            >
                <thead>
                    <tr>
                        <th>Property Name</th>
                        <th>Type</th>
                        <th>Format</th>
                        <th>Attributes</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='(field, field_it) in schema'
                        :key='field.name'
                        @click='edit(field)'
                    >
                        <td>
                            <div class='d-flex align-items-center'>
                                <span class='mx-3'>
                                    <template v-if='field.type === "string"'>
                                        <IconAlphabetLatin
                                            :size='32'
                                            :stroke='1'
                                        />
                                    </template>
                                    <template v-else-if='field.type === "number"'>
                                        <IconDecimal
                                            :size='32'
                                            :stroke='1'
                                        />
                                    </template>
                                    <template v-else-if='field.type === "integer"'>
                                        <IconSort09
                                            :size='32'
                                            :stroke='1'
                                        />
                                    </template>
                                    <template v-else>
                                        <IconBinary
                                            :size='32'
                                            :stroke='1'
                                        />
                                    </template>
                                </span>
                                <span v-text='field.name' />
                            </div>
                        </td>
                        <td v-text='field.type' />
                        <td v-text='field.format' />
                        <td>
                            <div class='d-flex align-items-center'>
                                <span
                                    v-if='field.required'
                                    style='height: 20px;'
                                    class='badge mx-1 mb-1 bg-red text-white'
                                >Required</span>
                                <div class='ms-auto'>
                                    <IconTrash
                                        v-if='!disabled'
                                        :size='32'
                                        :stroke='1'
                                        class='cursor-pointer'
                                        @click.stop='schema.splice(field_it, 1)'
                                    />
                                </div>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
            <div
                v-if='!disabled'
                class='col-12 px-2 py-2 d-flex'
            >
                <button
                    class='btn'
                    @click='processModelValue(layer.schema, true)'
                >
                    Cancel
                </button>
                <div class='ms-auto'>
                    <button
                        class='btn btn-primary'
                        @click='saveLayer'
                    >
                        Save
                    </button>
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
import { std, stdurl } from '/src/std.ts';
import LayerSchemaModal from './utils/LayerSchemaModal.vue';
import {
    TablerNone,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import {
    IconAlphabetLatin,
    IconSort09,
    IconPlus,
    IconSettings,
    IconDecimal,
    IconBinary,
    IconTrash,
    IconWorldDownload,
} from '@tabler/icons-vue'

export default {
    name: 'LayerSchema',
    components: {
        TablerNone,
        IconAlphabetLatin,
        IconSort09,
        IconDecimal,
        TablerLoading,
        IconPlus,
        IconSettings,
        IconBinary,
        LayerSchemaModal,
        IconTrash,
        IconWorldDownload,
    },
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
    watch: {
        layer: function() {
            this.processModelValue(this.layer.schema);
        }
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

            const layer = await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}`, {
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
            this.disabled = true;

            this.$emit('layer', layer);
        },
        fetchSchema: async function() {
            this.loading.schema = true;
            const url = stdurl(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/task/schema`);
            url.searchParams.append('type', 'schema:output');
            const schema = await std(url);

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
    }
}
</script>
