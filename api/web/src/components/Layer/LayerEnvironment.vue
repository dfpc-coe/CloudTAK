<template>
<div>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Environment</h3>
    </div>

    <TablerLoading v-if='loading.schema' desc='Loading Environment'/>
    <div v-else class="col">
        <template v-if='schema.type !== "object"'>
            <div class="d-flex justify-content-center my-4">
                Only Object Schemas are Supported.
            </div>
        </template>
        <template v-else>
            <Schema :schema='schema' :disabled='disabled' v-model='environment'/>
        </template>
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
                schema: false
            },
        };
    },
    mounted: async function() {
        await this.fetchSchema()

        this.environment = JSON.parse(JSON.stringify(this.layer.environment));
    },
    methods: {
        fetchSchema: async function() {
            this.alert = false;

            try {
                this.loading.schema = true;
                this.schema = (await window.std(`/api/layer/${this.$route.params.layerid}/task/schema`)).schema;
            } catch (err) {
                this.alert = true;
            }

            this.loading.schema = false;
        }
    },
    components: {
        Schema,
        PlusIcon,
        TablerInput,
        TablerLoading,
    }
}
</script>
