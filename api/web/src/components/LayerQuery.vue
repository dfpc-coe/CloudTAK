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
                        <div class="card-body">
                            <label class="form-label">ID Prefix</label>
                            <div class="input-icon mb-3">
                                <input v-model='params.filter' v-on:keyup.enter='query' type="text" class="form-control" placeholder="Search…">
                                <span class="input-icon-addon">
                                    <IconSearch/>
                                </span>
                            </div>

                            <div class='d-flex'>
                                <div class='ms-auto'>
                                    <button @click='query' class="cursor-pointer btn btn-primary">Search</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                    <div class="card">
                        <TablerLoading v-if='loading.query' desc='Loading Query'/>
                        <div v-else-if='error'>
                            <div class="text-center py-4">
                                <Alert title='Query Error' :err='error.message' :compact='true'/>
                                <div class="d-flex justify-content-center my-3">
                                    <div @click='query' class='btn btn-secondary'>Refresh</div>
                                </div>
                            </div>
                        </div>
                        <TablerNone v-else-if='!list.features.length' :create='false'/>
                        <div v-else class='table-responsive'>
                            <table class="table card-table table-vcenter">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Type</th>
                                        <th>Properties</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr :key='feature.id' v-for='feature in list.features'>
                                        <td><a @click='$router.push(`/layer/${$route.params.layerid}/query/${feature.id}`)' class='cursor-pointer' v-text='feature.id'></a></td>
                                        <td v-text='feature.geometry.type'></td>
                                        <td v-text='JSON.stringify(feature.properties)'></td>
                                    </tr>
                                </tbody>
                            </table>
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
    IconSearch
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerBreadCrumb, 
    TablerLoading
} from '@tak-ps/vue-tabler'

export default {
    name: 'LayerQuery',
    data: function() {
        return {
            error: false,
            params: {
                filter: ''
            },
            loading: {
                query: true
            },
            list: {
                type: 'FeatureCollection',
                features: []
            }
        }
    },
    mounted: async function() {
        await this.query();
    },
    methods: {
        query: async function() {
            this.error = false;
            this.loading.query = true;
            try {
                const url = window.stdurl(`/api/layer/${this.$route.params.layerid}/query`);
                url.searchParams.append('filter', this.params.filter);
                this.list = await window.std(url);
            } catch (err) {
                this.error = err;
            }
            this.loading.query = false;
        }
    },
    components: {
        TablerNone,
        Alert,
        PageFooter,
        IconSearch,
        TablerBreadCrumb, 
        TablerLoading,
    }
}
</script>
