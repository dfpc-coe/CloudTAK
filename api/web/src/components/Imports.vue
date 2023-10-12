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
                        <div class='card-header'>
                            <h3 class='card-title'>Imports</h3>
                        </div>
                        <TablerLoading v-if='loading'/>
                        <TablerNone
                            v-else-if='!list.imports.length'
                            label='Imports'
                            :create='false'
                        />
                        <div v-else class='table-responsive'>
                            <table class="table table-hover card-table table-vcenter cursor-pointer">
                                <thead><tr>
                                    <th>UID</th>
                                    <th>Created</th>
                                    <th>Result</th>
                                </tr></thead>
                                <tbody><tr @click='$router.push(`/import/${import.id}`)' :key='import.id' v-for='import in list.imports'>
                                    <td v-text='import.id'></td>
                                    <td v-text='import.created'></td>
                                    <td v-text='import.error || import.result'></td>
                                </tr></tbody>
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
import {
    TablerNone,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'Icons',
    data: function() {
        return {
            loading: true,
            list: {
                total: 0,
                imports: []
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/import');
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        SearchIcon,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading
    }
}
</script>
