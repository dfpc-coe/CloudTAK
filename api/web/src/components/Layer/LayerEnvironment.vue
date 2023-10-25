<template>
<div>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Environment</h3>
        <div class='ms-auto btn-list'>
            <SettingsIcon v-if='disabled' @click='disabled = false' class='cursor-pointer'/>
        </div>
    </div>

    <TablerLoading v-if='loading.schema' desc='Loading Environment'/>
    <TablerLoading v-else-if='loading.save' desc='Saving Environment'/>
    <div v-else class="col">
        <template v-if='schema.display === "arcgis"'>
            <div class='row g-2 mx-2 my-2'>
                <div class="col-12">
                    <TablerInput
                        label='ArcGIS Portal URL (Example: https://example.com/portal/sharing/rest)'
                        :disabled='disabled'
                        v-model='environment.ARCGIS_PORTAL'
                    />
                </div>
                <div v-if='environment.ARCGIS_URL' class="col-12">
                    <TablerInput
                        label='ArcGIS Layer URL'
                        :disabled='disabled'
                        v-model='environment.ARCGIS_URL'
                    />
                </div>
                <div class="col-12 col-md-6 mt-3">
                    <TablerInput
                        label='ArcGIS Username'
                        :disabled='disabled'
                        v-model='environment.ARCGIS_USERNAME'
                    />
                </div>
                <div class="col-12 col-md-6 mt-3">
                    <TablerInput
                        type='password'
                        label='ArcGIS Password'
                        :disabled='disabled'
                        v-model='environment.ARCGIS_PASSWORD'
                    />
                </div>
                <div class="col-12 mt-3">
                    <div class='d-flex'>
                        <div class='w-100'>
                            <TablerInput
                                label='ArcGIS SQL Query'
                                :disabled='disabled'
                                v-model='environment.ARCGIS_QUERY'
                            />
                        </div>
                        <button v-if='!disabled' @click='filterModal = true' class='btn' style='margin-left: 8px; margin-top: 26px;'><FilterIcon/> Query Editor</button>
                    </div>
                </div>
                <div class="col-md-12 mt-3">
                    <template v-if='!esriView'>
                        <div class='d-flex'>
                            <div class='ms-auto'>
                                <a @click='esriView = true' class="cursor-pointer btn btn-secondary">Connect</a>
                            </div>
                        </div>
                    </template>
                    <template v-else>
                        <EsriPortal
                            :disabled='disabled'
                            :url='environment.ARCGIS_PORTAL'
                            :username='environment.ARCGIS_USERNAME'
                            :password='environment.ARCGIS_PASSWORD'
                            :layer='environment.ARCGIS_URL'
                            @layer='environment.ARCGIS_URL = $event'
                            @token='environment.ARCGIS_TOKEN = $event'
                            @close='esriView = false'
                        />
                    </template>
                </div>
            </div>
        </template>
        <template v-else-if='schema.type !== "object"'>
            <div class="d-flex justify-content-center my-4">
                Only Object Schemas are Supported.
            </div>
        </template>
        <template v-else>
            <Schema :schema='schema' :disabled='disabled' v-model='environment'/>
        </template>
        <div v-if='!disabled' class="col-12 px-2 py-2 d-flex">
            <button @click='reload' class='btn'>Cancel</button>
            <div class='ms-auto'>
                <button @click='saveLayer' class='btn btn-primary'>Save</button>
            </div>
        </div>
    </div>

    <EsriFilter
        v-if='filterModal'
        @close='filterModal = false'
        v-model='environment.ARCGIS_QUERY'
        :token='environment.ARCGIS_TOKEN'
        :layer='environment.ARCGIS_URL'
    />
</div>
</template>

<script>
import {
    TablerInput,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import Schema from './utils/Schema.vue';
import EsriPortal from './../util/EsriPortal.vue';
import EsriFilter from './../util/EsriFilter.vue';
import {
    PlusIcon,
    FilterIcon,
    SettingsIcon,
} from 'vue-tabler-icons'

export default {
    name: 'LayerEnvironment',
    props: {
        layer: {
            type: Object,
            required: true
        },
    },
    data: function() {
        return {
            alert: false,
            esriView: false,
            disabled: true,
            environment: {},
            schema: {},
            filterModal: false,
            loading: {
                schema: false,
                save: false
            },
        };
    },
    mounted: async function() {
        this.reload();
        await this.fetchSchema()
    },
    methods: {
        reload: function() {
            this.environment = JSON.parse(JSON.stringify(this.layer.environment));
            this.disabled = true;
        },
        fetchSchema: async function() {
            this.alert = false;

            try {
                this.loading.schema = true;
                this.schema = (await window.std(`/api/layer/${this.$route.params.layerid}/task/schema`)).schema;
            } catch (err) {
                this.alert = true;
            }

            this.loading.schema = false;
        },
        saveLayer: async function() {
            this.loading.save = true;

            const layer = await window.std(`/api/layer/${this.$route.params.layerid}`, {
                method: 'PATCH',
                body: {
                    environment: this.environment
                }
            });

            this.disabled = true;
            this.loading.save = false;

            this.$emit('layer', layer);
        },
    },
    components: {
        Schema,
        PlusIcon,
        SettingsIcon,
        EsriPortal,
        TablerInput,
        TablerLoading,
        FilterIcon,
        EsriFilter
    }
}
</script>
