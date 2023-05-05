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
                    <TablerLoading v-if='loading'/>
                    <div v-else class="card">
                        <div class="card-header">
                            <ConnectionStatus :connection='connection'/>

                            <a @click='$router.push(`/connection/${connection.id}`)' class="card-title cursor-pointer" v-text='connection.name'></a>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <RefreshIcon class='cursor-pointer' @click='refresh'/>
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
                    <ConnectionLayers v-if='connection.id' :connection='connection'/>
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
    props: {
        ws: {
            type: Object,
            required: true
        }
    },
    data: function() {
        return {
            loading: true,
            connection: {}
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
            this.loading = true;
            this.connection = await window.std(`/api/connection/${this.$route.params.connectionid}`);
            this.loading = false;
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
        ConnectionEvents
    }
}
</script>
