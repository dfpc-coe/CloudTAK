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
        <template v-if='schema.type !== "object"'>
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
import Schema from './utils/Schema.vue';
import {
    PlusIcon,
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
            disabled: true,
            environment: {},
            schema: {},
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
        TablerInput,
        TablerLoading,
    }
}
</script>
