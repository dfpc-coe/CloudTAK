<template>
<div>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Environment</h3>
        <div class='ms-auto btn-list'>
            <template v-if='!raw && disabled'>
                <IconCode @click='raw = true' v-tooltip='"Raw View"' class='cursor-pointer'/>
                <IconSettings @click='disabled = false' class='cursor-pointer'/>
            </template>
            <template v-else-if='raw'>
                <IconX @click='raw = false' v-tooltip='"Close View"' class='cursor-pointer'/>
            </template>
        </div>
    </div>

    <TablerLoading v-if='loading.schema' desc='Loading Environment'/>
    <TablerLoading v-else-if='loading.save' desc='Saving Environment'/>
    <div v-else class="col">
        <template v-if='raw'>
            <pre v-text='environment'/>
        </template>
        <template v-else-if='schema.display === "arcgis"'>
            <LayerEnvironmentArcGIS v-model='environment' :disabled='disabled'/>
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
</div>
</template>

<script>
import {
    TablerInput,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import LayerEnvironmentArcGIS from './LayerEnvironmentArcGIS.vue';
import Schema from './utils/Schema.vue';
import {
    IconX,
    IconPlus,
    IconCode,
    IconSettings,
} from '@tabler/icons-vue'

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
            raw: false,
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
        IconPlus,
        IconCode,
        IconX,
        IconSettings,
        TablerInput,
        TablerLoading,
        LayerEnvironmentArcGIS
    }
}
</script>
