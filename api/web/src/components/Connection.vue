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
                                    <RefreshIcon class='cursor-pointer' @click='refresh'/>
                                    <SettingsIcon class='cursor-pointer' @click='$router.push(`/connection/${connection.id}/edit`)'/>
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
                                    <template v-else>
                                        <h3 class='subheader'>Channels</h3>
                                        <div v-for='channel in channels'>
                                            <span v-text='channel.name'/>
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

                <div class="col-lg-6 col-12">
                    <ConnectionLayers v-if='connection.id' :connection='connection'/>
                </div>

                <div class="col-lg-6 col-12">
                    <ConnectionSinks v-if='connection.id' :connection='connection'/>
                </div>

                <div class="col-lg-12">
                    <ConnectionChart v-if='connection.id' :connection='connection'/>
                </div>

                <div class="col-lg-12">
                    <ConnectionEvents :ws='ws' v-if='connection.id' :connection='connection'/>
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
import ConnectionLayers from './Connection/Layers.vue';
import ConnectionSinks from './Connection/Sinks.vue';
import ConnectionChart from './Connection/Chart.vue';
import ConnectionEvents from './Connection/Events.vue';
import timeDiff from '../timediff.js';
import {
    RefreshIcon,
    SettingsIcon
} from 'vue-tabler-icons'
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
            ws: null,
            channels: [],
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
        const url = window.stdurl('/api');
        if (window.location.hostname === 'localhost') {
            url.protocol = 'ws:';
        } else {
            url.protocol = 'wss:';
        }

        this.ws = new WebSocket(url);
        this.ws.addEventListener('error', (err) => { this.$emit('err') });

        await this.fetch();
        await this.fetchChannels();

    },
    unmounted: function() {
        this.ws.close();
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
            this.channels = (await window.std(`/api/connection/${this.$route.params.connectionid}/channel`)).data;
            this.loading.channels = false;
        },
        refresh: async function() {
            this.connection = await window.std(`/api/connection/${this.$route.params.connectionid}/refresh`, {
                method: 'POST'
            });
        }
    },
    components: {
        SettingsIcon,
        RefreshIcon,
        PageFooter,
        TablerBreadCrumb,
        TablerMarkdown,
        TablerLoading,
        ConnectionStatus,
        ConnectionLayers,
        ConnectionSinks,
        ConnectionChart,
        ConnectionEvents
    }
}
</script>
