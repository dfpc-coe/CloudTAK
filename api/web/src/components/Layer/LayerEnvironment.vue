<template>
    <div>
        <div class='card-header d-flex'>
            <h3 class='card-title'>
                Environment
            </h3>
            <div
                v-if='!editing'
                class='ms-auto btn-list'
            >
                <template v-if='!raw && disabled'>
                    <IconCode
                        v-tooltip='"Raw View"'
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                        @click='raw = true'
                    />
                    <IconPencil
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                        @click='disabled = false'
                    />
                </template>
                <template v-else-if='raw'>
                    <IconX
                        v-tooltip='"Close View"'
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                        @click='raw = false'
                    />
                </template>
            </div>
        </div>

        <div
            v-if='softAlert'
            class='bg-red-lt mx-2 px-2 py-2 my-2 rounded border border-red justify-content-center'
        >
            <div>Output Schema could not be loaded from upstream source:</div>
            <div v-text='softAlert.message' />
        </div>

        <TablerLoading
            v-if='loading.schema'
            desc='Loading Environment'
        />
        <TablerLoading
            v-else-if='loading.save'
            desc='Saving Environment'
        />
        <div
            v-else
            class='col'
        >
            <template v-if='raw'>
                <pre v-text='environment' />
            </template>
            <template v-else-if='alert'>
                <TablerAlert
                    title='Layer failed to return an Environment Schema'
                    :err='alert'
                />
            </template>
            <template v-else-if='schema.display === "arcgis"'>
                <LayerEnvironmentArcGIS
                    v-model='environment'
                    :disabled='disabled'
                />
            </template>
            <template v-else-if='schema.type !== "object"'>
                <div class='d-flex justify-content-center my-4'>
                    Only Object Schemas are Supported.
                </div>
            </template>
            <template v-else>
                <Schema
                    v-model='environment'
                    :schema='schema'
                    :disabled='disabled'
                />
            </template>

            <div class='px-2 pb-3'>
                <!-- AutoSuggested Filters -->
                <template v-if='config.timezone'>
                    <TablerTimeZone
                        v-model='config.timezone.timezone'
                        label='Date TimeZone Override'
                        :disabled='disabled'
                    />
                </template>
            </div>

            <div
                v-if='!disabled'
                class='col-12 px-2 py-2 d-flex'
            >
                <button
                    v-if='!editing'
                    class='btn'
                    @click='reload'
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
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import {
    TablerAlert,
    TablerLoading,
    TablerTimeZone,
} from '@tak-ps/vue-tabler';
import LayerEnvironmentArcGIS from './LayerEnvironmentArcGIS.vue';
import Schema from './utils/Schema.vue';
import {
    IconX,
    IconCode,
    IconPencil,
} from '@tabler/icons-vue'

export default {
    name: 'LayerEnvironment',
    components: {
        Schema,
        IconCode,
        IconX,
        IconPencil,
        TablerTimeZone,
        TablerAlert,
        TablerLoading,
        LayerEnvironmentArcGIS
    },
    props: {
        layer: {
            type: Object,
            required: true
        },
        editing: {
            type: Boolean,
            default: false
        }
    },
    emits: [
        'layer'
    ],
    data: function() {
        return {
            raw: false,
            alert: false,
            softAlert: false,
            esriView: false,
            disabled: this.editing ? false : true,
            config: {},
            environment: {},
            schema: { properties: {} },
            schemaOutput: { properties: {} },
            filterModal: false,
            loading: {
                schema: true,
                save: false
            },
        };
    },
    watch: {
        editing: function() {
            if (this.editing) {
                this.disabled = false;
            }
        }
    },
    mounted: async function() {
        await this.reload();
    },
    methods: {
        hasDateTime: function() {
            for (const prop of Object.keys(this.schemaOutput.properties)) {
                if (this.schemaOutput.properties[prop].format && this.schemaOutput.properties[prop].format === 'date-time') {
                    return true;
                }
            }
            return false;
        },
        reload: async function() {
            await this.fetchSchema()
            this.environment = JSON.parse(JSON.stringify(this.layer.environment));
            const config = JSON.parse(JSON.stringify(this.layer.config));

            if (!this.hasDateTime()) {
                delete config.timezone;
            } else if (!config.timezone) {
                config.timezone = { timezone: 'No TimeZone' }
            }

            this.config = config;

            if (!this.editing) this.disabled = true;

            this.loading.schema = false;
        },
        fetchSchema: async function() {
            this.alert = false;

            try {
                this.loading.schema = true;
                this.schema = (await std(`/api/connection/${this.layer.connection}/layer/${this.layer.id}/task/schema`)).schema;
            } catch (err) {
                this.alert = err;
            }

            try {
                const output = (await std(`/api/connection/${this.layer.connection}/layer/${this.layer.id}/task/schema?type=schema:output`)).schema;
                if (output.properties) this.schemaOutput = output;
            } catch (err) {
                this.softAlert = err;
            }
        },
        saveLayer: async function() {
            this.loading.save = true;

            const layer = await std(`/api/connection/${this.layer.connection}/layer/${this.layer.id}`, {
                method: 'PATCH',
                body: {
                    environment: this.environment,
                    config: this.config
                }
            });

            this.disabled = true;
            this.loading.save = false;

            this.$emit('layer', layer);
        },
    }
}
</script>
