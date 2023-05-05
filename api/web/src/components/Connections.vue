<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <TablerBreadCrumb/>

                        <div class='ms-auto'>
                            <div class='btn-list'>
                                <a @click='query = !query' class="cursor-pointer btn btn-secondary">
                                    <SearchIcon/>
                                </a>

                                <a @click='$router.push("/connection/new")' class="cursor-pointer btn btn-primary">
                                    New Connection
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div v-if='query' class="col-lg-12">
                    <div class="card">
                        <div class="card-body">
                            <label class="form-label">Connection Search</label>
                            <div class="input-icon mb-3">
                                <input v-model='paging.filter' type="text"  class="form-control" placeholder="Search…">
                                <span class="input-icon-addon">
                                    <SearchIcon/>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <template v-if='loading'>
                    <TablerLoading/>
                </template>
                <template v-else>
                    <None
                        v-if='!list.connections.length'
                        label='Connections'
                        @create='$router.push("/connection/new")'
                    />
                    <template v-else>
                        <div :key='connection.id' v-for='connection in list.connections' class="col-lg-12">
                            <div class="card">
                                <div class="card-header">
                                    <ConnectionStatus :connection='connection'/>

                                    <a @click='$router.push(`/connection/${connection.id}`)' class="card-title cursor-pointer" v-text='connection.name'></a>

                                    <div class='ms-auto'>
                                        <div class='btn-list'>
                                            <SettingsIcon class='cursor-pointer' @click='$router.push(`/connection/${connection.id}/edit`)'/>
                                        </div>
                                    </div>
                                </div>
                                <TablerMarkdown class="card-body" :markdown='connection.description'/>
                                <div class="card-footer">
                                    Last updated <span v-text='timeDiff(connection.updated)'/>
                                </div>
                            </div>
                        </div>

                        <div class="col-lg-12">
                            <Pager @page='paging.page = $event' :current='paging.page'  :total='list.total' :limit='paging.limit'/>
                        </div>
                    </template>
                </template>
            </div>
        </div>
    </div>
    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import Pager from './util/Pager.vue';
import ConnectionStatus from './Connection/Status.vue';
import None from './cards/None.vue';
import timeDiff from '../timediff.js';
import {
    TablerBreadCrumb,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    SettingsIcon,
    SearchIcon
} from 'vue-tabler-icons'

export default {
    name: 'Connections',
    data: function() {
        return {
            err: false,
            loading: true,
            query: false,
            paging: {
                filter: '',
                limit: 10,
                page: 0
            },
            list: {
                total: 0,
                connections: []
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    watch: {
       'paging.page': async function() {
           await this.fetchList();
       },
       'paging.filter': async function() {
           await this.fetchList();
       },
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/connection');
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        None,
        Pager,
        SettingsIcon,
        SearchIcon,
        PageFooter,
        TablerBreadCrumb,
        ConnectionStatus,
        TablerMarkdown,
        TablerLoading
    }
}
</script>
