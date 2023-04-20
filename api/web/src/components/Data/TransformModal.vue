<template>
    <TablerModal>
        <button type="button" class="btn-close" @click='close' aria-label="Close"></button>
        <div class="modal-status bg-yellow"></div>
        <div class="modal-body py-4">
            <h3 class='subtitle-header'>Asset Transform:</h3>

            <TablerLoading v-if='loading'/>
            <template v-else>
                <GenericSchema v-model='transform' :schema='schema'/>

                <div class='col-12 d-flex'>
                    <div class='ms-auto'>
                        <button @click='submit' class='btn btn-primary'>Submit</button>
                    </div>
                </div>
            </template>
        </div>
    </TablerModal>
</template>

<script>
import {
    TablerModal,
    TablerLoading
} from '@tak-ps/vue-tabler';
import GenericSchema from '../util/Schema.vue';

export default {
    name: 'TransformModal',
    props: {
        asset: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            loading: true,
            schema: {},
            transform: {}
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            const url = window.stdurl('/api/schema');
            url.searchParams.append('method', 'POST');
            url.searchParams.append('url', '/data/:dataid/asset/:asset.:ext');
            const schema = await window.std(url);

            this.schema = schema.body;

            this.loading = false;
        },
        submit: async function() {
            this.loading = true;
            await window.std(`/api/data/${this.$route.params.dataid}/asset/${this.asset.name}`, {
                method: 'POST',
                body: this.transform
            });
            this.loading = false;
            this.close();
        },
        close: function() {
            this.$emit('close');
        },
    },
    components: {
        TablerModal,
        TablerLoading,
        GenericSchema
    }
}
</script>
