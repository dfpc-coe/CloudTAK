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
                    <TablerLoading v-if='loading.connection'/>

                    <div v-else class="card">
                        <div class="card-header">
                            <ConnectionStatus :connection='connection'/>

                            <a @click='$router.push(`/connection/${connection.id}`)' class="card-title cursor-pointer mx-2" v-text='connection.name'></a>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <IconRefresh size='32' class='cursor-pointer' @click='refresh' v-tooltip='"Refresh"' />
                                    <IconSettings size='32' class='cursor-pointer' @click='$router.push(`/connection/${connection.id}/edit`)' v-tooltip='"Edit"'/>
                                </div>
                            </div>
                        </div>
                        <div class='card-body'>
                            <div class='row g-2'>
                                <div class='col-12'>
                                    <TablerMarkdown :markdown='connection.description'/>
                                </div>
                                <div class='col-12 datagrid'>
                                    <div class="datagrid-item pb-2">
                                        <div class="datagrid-title">Certificate Valid From</div>
                                        <div class="datagrid-content" v-text='connection.certificate.validFrom'></div>
                                    </div>
                                    <div class="datagrid-item pb-2">
                                        <div class="datagrid-title">Certificate Valid From</div>
                                        <div class="datagrid-content" v-text='connection.certificate.validTo'></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="card-footer">
                            Last updated <span v-text='timeDiff(connection.updated)'/>
                        </div>
                    </div>
                </div>

                <div v-if='!loading.connection' class='col-lg-12'>
                    <div class='card'>
                        <div class='row g-0'>
                            <div class="col-12 col-md-3 border-end">
                                <div class="card-body">
                                    <h4 class="subheader">Connection Sections</h4>
                                    <div class="list-group list-group-transparent">
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/layer`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-layer",
                                            "cursor-pointer": $route.name !== "connection-layer"
                                        }'><IconBuildingBroadcastTower size='32'/><span class='mx-3'>Layers</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/groups`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-groups",
                                            "cursor-pointer": $route.name !== "connection-groups"
                                        }'><IconAffiliate size='32'/><span class='mx-3'>Channels</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/data`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-data",
                                            "cursor-pointer": $route.name !== "connection-data"
                                        }'><IconDatabase size='32'/><span class='mx-3'>Data Store</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/sink`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-sink",
                                            "cursor-pointer": $route.name !== "connection-sink"
                                        }'><IconOutbound size='32'/><span class='mx-3'>Outbounds Sinks</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/health`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-health",
                                            "cursor-pointer": $route.name !== "connection-health"
                                        }'><IconCloudDataConnection size='32'/><span class='mx-3'>Health &amp; Metrics</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/tokens`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-tokens",
                                            "cursor-pointer": $route.name !== "connection-tokens"
                                        }'><IconRobot size='32'/><span class='mx-3'>API Tokens</span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-md-9 position-relative">
                                <router-view
                                    :connection='connection'
                                />
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
import { std, stdurl } from '/std.ts';
import PageFooter from './PageFooter.vue';
import ConnectionStatus from './Connection/Status.vue';
import timeDiff from '../timediff.js';
import {
    IconRobot,
    IconRefresh,
    IconDatabase,
    IconOutbound,
    IconAffiliate,
    IconCloudDataConnection,
    IconBuildingBroadcastTower,
    IconSettings
} from '@tabler/icons-vue'
import {
    TablerBreadCrumb,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler';

export default {
    name: 'Connection',
    data: function() {
        return {
            loading: {
                connection: true,
            },
            err: null,
            connection: {}
        }
    },
    watch: {
        err: async function() {
            if (!this.err) return;
            const err = this.err;
            this.err = null;
            throw err;
        }
    },
    mounted: async function() {
        await this.fetch();

    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        fetch: async function() {
            this.loading.connection = true;
            this.connection = await std(`/api/connection/${this.$route.params.connectionid}`);
            this.loading.connection = false;
        },
        refresh: async function() {
            this.connection = await std(`/api/connection/${this.$route.params.connectionid}/refresh`, {
                method: 'POST'
            });
        }
    },
    components: {
        IconRobot,
        IconSettings,
        IconAffiliate,
        IconRefresh,
        IconDatabase,
        IconBuildingBroadcastTower,
        IconCloudDataConnection,
        IconOutbound,
        PageFooter,
        TablerBreadCrumb,
        TablerMarkdown,
        TablerLoading,
        ConnectionStatus,
    }
}
</script>
