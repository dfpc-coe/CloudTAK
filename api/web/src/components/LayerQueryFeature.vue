<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <TablerBreadCrumb/>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <TablerLoading v-if='loading.feature' desc='Loading Feature'/>
                        <div v-else-if='error'>
                            <Alert title='Query Error' :err='error.message' :compact='true'/>

                            <div class="d-flex justify-content-center my-3">
                                <div @click='query' class='btn btn-secondary'>Refresh</div>
                            </div>
                        </div>
                        <div v-else>
                            <pre v-text='feature'/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import Alert from './util/Alert.vue';
import {
    TablerBreadCrumb, 
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'LayerQueryFeature',
    data: function() {
        return {
            error: false,
            loading: {
                feature: true
            },
            feature: ''
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.error = false;
            this.loading.feature = true;
            try {
                const url = window.stdurl(`/api/layer/${this.$route.params.layerid}/query/${this.$route.params.featid}`);
                this.feature = JSON.stringify(await window.std(url), null, 4);
            } catch (err) {
                this.error = err;
            }
            this.loading.feature = false;
        }
    },
    components: {
        Alert,
        PageFooter,
        TablerBreadCrumb, 
        TablerLoading,
    }
}
</script>
