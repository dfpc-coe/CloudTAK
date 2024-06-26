<template>
    <div>
        <div class='card-header d-flex'>
            <h3 class='card-title'>
                Environment
            </h3>
            <div class='ms-auto btn-list'>
                <template v-if='!raw && disabled'>
                    <IconCode
                        v-tooltip='"Raw View"'
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                        @click='raw = true'
                    />
                    <IconSettings
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
    TablerLoading,
    TablerTimeZone,
} from '@tak-ps/vue-tabler';
import LayerEnvironmentArcGIS from './LayerEnvironmentArcGIS.vue';
import Schema from './utils/Schema.vue';
import {
    IconX,
    IconCode,
    IconSettings,
} from '@tabler/icons-vue'

export default {
    name: 'LayerEnvironment',
    components: {
        Schema,
        IconCode,
        IconX,
        IconSettings,
        TablerTimeZone,
        TablerLoading,
        LayerEnvironmentArcGIS
    },
    props: {
        layer: {
            type: Object,
            required: true
        },
    },
    data: function() {
        return {
            raw: false,
            alert: false,
            esriView: false,
            disabled: true,
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

            this.disabled = true;

            this.loading.schema = false;
        },
        fetchSchema: async function() {
            this.alert = false;

            try {
                this.loading.schema = true;
                this.schema = (await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/task/schema`)).schema;
            } catch (err) {
                this.alert = true;
            }

            try {
                const output = (await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/task/schema?type=schema:output`)).schema;
                if (output.properties) this.schemaOutput = output;
            } catch (err) {
                //For now this is allowed to fail as dynamic schemas can require input schemas to be defined
                console.error(err)
            }
        },
        saveLayer: async function() {
            this.loading.save = true;

            const layer = await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}`, {
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
