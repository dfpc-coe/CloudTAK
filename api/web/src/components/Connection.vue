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
                                    <IconRefresh class='cursor-pointer' @click='refresh' v-tooltip='"Refresh"' />
                                    <IconSettings class='cursor-pointer' @click='$router.push(`/connection/${connection.id}/edit`)' v-tooltip='"Edit"'/>
                                </div>
                            </div>
                        </div>
                        <div class='card-body'>
                            <div class='row g-2'>
                                <div class='col-12 col-md-8'>
                                    <TablerMarkdown :markdown='connection.description'/>
                                </div>
                                <div class='col-12 col-md-4'>
                                    <TablerLoading v-if='loading.channels' desc='Loading Channels'/>
                                    <TablerNone v-else-if='!rawChannels.length' :create='false'/>
                                    <template v-else>
                                        <div :key='ch.name' v-for='ch in processChannels' class="col-lg-12 hover-light">
                                            <div class='col-12 py-2 px-2 d-flex align-items-center'>
                                                <IconEye v-if='ch.active'/>
                                                <IconEyeOff v-else />
                                                <span class="mx-2" v-text='ch.name'></span>
                                            </div>
                                        </div>
                                    </template>
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
                                        }'><IconBuildingBroadcastTower/><span class='mx-3'>Layers</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/data`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-data",
                                            "cursor-pointer": $route.name !== "connection-data"
                                        }'><IconDatabase/><span class='mx-3'>Data Store</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/sink`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-sink",
                                            "cursor-pointer": $route.name !== "connection-sink"
                                        }'><IconOutbound/><span class='mx-3'>Outbounds Sinks</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/health`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "connection-health",
                                            "cursor-pointer": $route.name !== "connection-health"
                                        }'><IconCloudDataConnection/><span class='mx-3'>Health &amp; Metrics</span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-md-9">
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
import PageFooter from './PageFooter.vue';
import ConnectionStatus from './Connection/Status.vue';
import timeDiff from '../timediff.js';
import {
    IconEye,
    IconEyeOff,
    IconRefresh,
    IconDatabase,
    IconOutbound,
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
                channels: true,
            },
            err: null,
            rawChannels: [],
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
        await this.fetchChannels();

    },
    computed: {
        processChannels: function() {
            const channels = {};

            JSON.parse(JSON.stringify(this.rawChannels)).sort((a, b) => {
                return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
            }).forEach((channel) => {
                if (channels[channel.name]) {
                    channels[channel.name].direction.push(channel.direction);
                } else {
                    channel.direction = [channel.direction];
                    channels[channel.name] = channel;
                }
            });

            return channels;
        }
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        fetch: async function() {
            this.loading.connection = true;
            this.connection = await window.std(`/api/connection/${this.$route.params.connectionid}`);
            this.loading.connection = false;
        },
        fetchChannels: async function() {
            this.loading.channels = true;
            this.rawChannels = (await window.std(`/api/connection/${this.$route.params.connectionid}/channel`)).data;
            this.loading.channels = false;
        },
        refresh: async function() {
            this.connection = await window.std(`/api/connection/${this.$route.params.connectionid}/refresh`, {
                method: 'POST'
            });
        }
    },
    components: {
        IconEye,
        IconEyeOff,
        IconSettings,
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
