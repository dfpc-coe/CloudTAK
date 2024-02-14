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

    <TablerLoading v-if='loading.data' desc='Loading Data'/>
    <div v-else class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class="card-header">
                            <ConnectionStatus :connection='connection'/>

                            <a @click='$router.push(`/connection/${connection.id}`)' class="card-title cursor-pointer mx-2" v-text='connection.name'></a>

                            <span class='mx-1'>-</span>

                            <div class='card-title mx-1' v-text='data.name'></div>

                            <div class='ms-auto'>
                                <div class='btn-list'>
                                    <IconAccessPoint v-if='data.mission_sync' class='text-green' v-tooltip='"Mission Sync On"'/>
                                    <IconAccessPointOff v-else class='text-red' v-tooltip='"Mission Sync Off"'/>

                                    <IconSettings class='cursor-pointer' @click='$router.push(`/connection/${$route.params.connectionid}/data/${data.id}/edit`)' v-tooltip='"Edit"'/>
                                </div>
                            </div>
                        </div>
                        <TablerMarkdown class='card-body' :markdown='data.description'/>
                        <div class="card-footer">
                            Last updated <span v-text='timeDiff(data.updated)'/>
                        </div>
                    </div>
                </div>
                <div class="col-lg-12">
                    <div class='card'>
                        <div class='row g-0'>
                            <div class="col-12 col-md-3 border-end">
                                <div class="card-body">
                                    <h4 class="subheader">Data Sections</h4>
                                    <div class="list-group list-group-transparent">
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/groups`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "data-groups",
                                            "cursor-pointer": $route.name !== "data-groups"
                                        }'><IconAffiliate/><span class='mx-3'>Channels</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/files`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "data-files",
                                            "cursor-pointer": $route.name !== "data-files"
                                        }'><IconFiles/><span class='mx-3'>Files</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/layer`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "data-layer",
                                            "cursor-pointer": $route.name !== "data-layer"
                                        }'><IconBuildingBroadcastTower/><span class='mx-3'>Layers</span></span>
                                        <span @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/jobs`)' class="list-group-item list-group-item-action d-flex align-items-center" :class='{
                                            "active": $route.name === "data-jobs",
                                            "cursor-pointer": $route.name !== "data-jobs"
                                        }'><IconTransform/><span class='mx-3'>Jobs</span></span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-12 col-md-9">
                                <router-view
                                    :data='data'
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
import timeDiff from '../timediff.js';
import {
    TablerModal,
    TablerLoading,
    TablerMarkdown,
    TablerBreadCrumb,
} from '@tak-ps/vue-tabler'
import {
    IconFiles,
    IconAffiliate,
    IconBuildingBroadcastTower,
    IconTransform,
    IconSettings,
    IconAccessPoint,
    IconAccessPointOff,
} from '@tabler/icons-vue'
import ConnectionStatus from './Connection/Status.vue';

export default {
    name: 'DataSingle',
    data: function() {
        return {
            err: false,
            loading: {
                data: true
            },
            connection: {},
            data: {},
        }
    },
    mounted: async function() {
        await this.fetchConnection();
        await this.fetch();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        fetchConnection: async function() {
            this.connection = await window.std(`/api/connection/${this.$route.params.connectionid}`);
        },
        fetch: async function() {
            this.loading.data = true;
            this.data = await window.std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}`);
            this.loading.data = false;
        }
    },
    components: {
        IconFiles,
        IconAffiliate,
        IconTransform,
        IconBuildingBroadcastTower,
        IconSettings,
        PageFooter,
        TablerLoading,
        TablerBreadCrumb,
        TablerMarkdown,
        IconAccessPoint,
        IconAccessPointOff,
        ConnectionStatus
    }
}
</script>
