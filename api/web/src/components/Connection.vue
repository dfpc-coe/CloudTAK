<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <TablerLoading
                                v-if='loading.connection'
                                class='text-white'
                            />
                            <template v-else>
                                <div class='card-header'>
                                    <ConnectionStatus :connection='connection' />

                                    <a
                                        class='card-title cursor-pointer mx-2'
                                        @click='$router.push(`/connection/${connection.id}`)'
                                        v-text='connection.name'
                                    />

                                    <div class='ms-auto d-flex align-items-center btn-list'>
                                        <AgencyBadge :connection='connection' />

                                        <IconPlugConnected
                                            v-tooltip='"Cycle Connection"'
                                            :size='32'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click='refresh'
                                        />
                                        <IconRefresh
                                            v-tooltip='"Refresh"'
                                            :size='32'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click='fetch'
                                        />
                                        <IconSettings
                                            v-tooltip='"Edit"'
                                            :size='32'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click='$router.push(`/connection/${connection.id}/edit`)'
                                        />
                                    </div>
                                </div>
                                <div class='card-body'>
                                    <div class='row g-2'>
                                        <div class='col-12'>
                                            <TablerMarkdown :markdown='connection.description' />
                                        </div>
                                        <div class='col-12 datagrid'>
                                            <div class='datagrid-item pb-2'>
                                                <div class='datagrid-title'>
                                                    Certificate Valid From
                                                </div>
                                                <div
                                                    class='datagrid-content'
                                                    v-text='connection.certificate.validFrom'
                                                />
                                            </div>
                                            <div class='datagrid-item pb-2'>
                                                <div class='datagrid-title'>
                                                    Certificate Valid To
                                                </div>
                                                <div
                                                    class='datagrid-content'
                                                    v-text='connection.certificate.validTo'
                                                />
                                            </div>
                                            <div class='datagrid-item pb-2'>
                                                <div class='datagrid-title'>
                                                    Certificate Subject
                                                </div>
                                                <div
                                                    class='datagrid-content'
                                                    v-text='connection.certificate.subject'
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class='card-footer'>
                                    Last updated <span v-text='timeDiff(connection.updated)' />
                                </div>
                            </template>
                        </div>
                    </div>

                    <div
                        v-if='!loading.connection'
                        class='col-lg-12'
                    >
                        <div class='card'>
                            <div class='row g-0'>
                                <div class='col-12 col-md-3 border-end'>
                                    <div class='card-body'>
                                        <h4 class='subheader'>
                                            Connection Sections
                                        </h4>
                                        <div class='list-group list-group-transparent'>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "connection-layers",
                                                    "cursor-pointer": $route.name !== "connection-layers"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/layer`)'
                                            ><IconBuildingBroadcastTower
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Layers</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "connection-groups",
                                                    "cursor-pointer": $route.name !== "connection-groups"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/groups`)'
                                            ><IconAffiliate 
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Channels</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "connection-datas",
                                                    "cursor-pointer": $route.name !== "connection-datas"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/data`)'
                                            ><IconDatabase
                                                :size='32' 
                                                :stroke='1' 
                                            /><span class='mx-3'>Data Syncs</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "connection-sinks",
                                                    "cursor-pointer": $route.name !== "connection-sinks"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/sink`)'
                                            ><IconOutbound 
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Outbounds Sinks</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "connection-healths",
                                                    "cursor-pointer": $route.name !== "connection-healths"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/health`)'
                                            ><IconCloudDataConnection
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Health &amp; Metrics</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "connection-tokens",
                                                    "cursor-pointer": $route.name !== "connection-tokens"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/tokens`)'
                                            ><IconRobot
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>API Tokens</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9 position-relative'>
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

        <PageFooter />
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import ConnectionStatus from './Connection/Status.vue';
import timeDiff from '../timediff.ts';
import {
    IconRobot,
    IconRefresh,
    IconDatabase,
    IconOutbound,
    IconAffiliate,
    IconPlugConnected,
    IconCloudDataConnection,
    IconBuildingBroadcastTower,
    IconSettings
} from '@tabler/icons-vue'
import {
    TablerBreadCrumb,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import AgencyBadge from './Connection/AgencyBadge.vue';

export default {
    name: 'TAKConnection',
    components: {
        AgencyBadge,
        IconRobot,
        IconSettings,
        IconAffiliate,
        IconRefresh,
        IconDatabase,
        IconPlugConnected,
        IconBuildingBroadcastTower,
        IconCloudDataConnection,
        IconOutbound,
        PageFooter,
        TablerBreadCrumb,
        TablerMarkdown,
        TablerLoading,
        ConnectionStatus,
    },
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
    }
}
</script>
