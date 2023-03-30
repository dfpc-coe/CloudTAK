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

    <TablerLoading v-if='loading.logs' desc='Loading Job Logs'/>
    <div v-else class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class="card-header">
                            <h2 class='card-title'>Job Logs</h2>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                </div>
                            </div>
                        </div>
                        <div class="card-body">
                            <pre>LOGS</pre>
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
import {
    TablerLoading,
    TablerBreadCrumb
} from '@tak-ps/vue-tabler'

export default {
    name: 'DataJob',
    data: function() {
        return {
            err: false,
            loading: {
                logs: true
            },
            logs: []
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.loading.logs = true;
            this.data = await window.std(`/api/data/${this.$route.params.dataid}`);
            this.loading.logs = false;
        }
    },
    components: {
        PageFooter,
        TablerLoading,
        TablerBreadCrumb
    }
}
</script>
