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
                        <div class='card-header d-flex'>
                            <h1 class='card-title'>Layer Alerts</h1>
                            <div class='ms-auto btn-list'>
                                <TrashIcon @click='deleteAlerts' class='cursor-pointer'/>
                            </div>
                        </div>

                        <TablerLoading v-if='loading.query' desc='Loading Query'/>
                        <None v-else-if='!list.total' :create='false'/>
                        <div v-else class='row'>
                            <div :key='alert.id' v-for='alert in list.alerts'>
                                <span  v-text='alert.title'/>
                                <span  v-text='alert.description'/>
                            </div>
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
import None from './cards/None.vue';
import {
    TrashIcon,
    AlertCircleIcon
} from 'vue-tabler-icons';
import {
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'LayerAlerts',
    data: function() {
        return {
            params: {
                filter: ''
            },
            loading: {
                alerts: true
            },
            list: {
                alerts: []
            }
        }
    },
    mounted: async function() {
        await this.query();
    },
    methods: {
        query: async function() {
            this.loading.alerts = true;
            const url = window.stdurl(`/api/layer/${this.$route.params.layerid}/alert`);
            url.searchParams.append('filter', this.params.filter);
            this.list = await window.std(url);
            this.loading.alerts = false;
        },
        deleteAlerts: async function() {
            this.loading.alerts = true;
            window.std(`/api/layer/${this.$route.params.layerid}/alert`, {
                method: 'DELETE'
            });
            await this.query();
        }
    },
    components: {
        None,
        PageFooter,
        TrashIcon,
        TablerBreadCrumb,
        TablerLoading,
        AlertCircleIcon
    }
}
</script>
