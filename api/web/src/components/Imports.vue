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

                            <div class='ms-auto btn-list'>
                                <RefreshIcon @click='fetchList' v-tooltip='`Refresh Import`' class='cursor-pointer'/>
                            </div>
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
                                    <th>Name</th>
                                    <th>Created</th>
                                    <th>Result</th>
                                </tr></thead>
                                <tbody><tr @click='$router.push(`/import/${imported.id}`)' :key='imported.id' v-for='imported in list.imports'>
                                    <td>
                                        <div class='d-flex'>
                                            <Status :status='imported.status'/>
                                            <div class='d-flex align-items-center' v-text='imported.id'></div>
                                        </div>
                                   </td>
                                    <td v-text='imported.name'></td>
                                    <td v-text='timeDiff(imported.created)'></td>
                                    <td v-text='imported.error || imported.result'></td>
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
import timeDiff from '../timediff.js';
import PageFooter from './PageFooter.vue';
import Status from './util/Status.vue';
import {
    TablerNone,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    RefreshIcon
} from 'vue-tabler-icons';

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
        timeDiff(update) {
            return timeDiff(update);
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/import');
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        Status,
        RefreshIcon,
        TablerNone,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading
    }
}
</script>
