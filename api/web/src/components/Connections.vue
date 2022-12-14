<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/")' class='cursor-pointer'>Home</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#">Connections</a></li>
                        </ol>

                        <div class='ms-auto'>
                            <div class='btn-list'>
                                <a @click='query.shown = !query.shown' class="cursor-pointer btn btn-secondary">
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
                <div v-if='query.shown' class="col-lg-12">
                    <div class="card">
                        <div class="card-body">
                            <label class="form-label">Connection Search</label>
                            <div class="input-icon mb-3">
                                <input v-model='query.search' type="text"  class="form-control" placeholder="Search…">
                                <span class="input-icon-addon">
                                    <SearchIcon/>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <None
                    v-if='!list.connections.length'
                    label='Connections'
                    @create='$router.push("/connection/new")'
                />
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
                        <div class="card-body" v-text='connection.description'>
                        </div>
                        <div class="card-footer">
                            Last updated 3 mins ago
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
import ConnectionStatus from './Connection/Status.vue';
import None from './cards/None.vue';
import {
    SettingsIcon,
    SearchIcon
} from 'vue-tabler-icons'

export default {
    name: 'Connections',
    data: function() {
        return {
            err: false,
            query: {
                shown: false,
                search: ''
            },
            list: {
                connections: []
            }
        }
    },
    watch: {
        'query.search': function() {
            this.fetchList();
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            const url = window.stdurl('/api/connection');
            if (this.query.shown && this.query.search) url.searchParams.append('filter', this.query.search);
            this.list = await window.std(url);
        }
    },
    components: {
        None,
        SettingsIcon,
        SearchIcon,
        PageFooter,
        ConnectionStatus
    }
}
</script>
