<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <TablerLoading
            v-if='loading.data'
            desc='Loading Data'
        />
        <div
            v-else
            class='page-body'
        >
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='card-header'>
                                <ConnectionStatus :connection='connection' />

                                <a
                                    class='card-title cursor-pointer mx-2'
                                    @click='$router.push(`/connection/${connection.id}`)'
                                    v-text='connection.name'
                                />

                                <span class='mx-1'>-</span>

                                <div
                                    class='card-title mx-1'
                                    v-text='data.name'
                                />

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <IconAccessPoint
                                            v-if='data.mission_sync'
                                            v-tooltip='"Mission Sync On"'
                                            :size='32'
                                            :stroke='1'
                                            class='text-green'
                                        />
                                        <IconAccessPointOff
                                            v-else
                                            v-tooltip='"Mission Sync Off"'
                                            :size='32'
                                            :stroke='1'
                                            class='text-red'
                                        />

                                        <IconSettings
                                            v-tooltip='"Edit"'
                                            :size='32'
                                            :stroke='1'
                                            class='cursor-pointer'
                                            @click='$router.push(`/connection/${$route.params.connectionid}/data/${data.id}/edit`)'
                                        />
                                    </div>
                                </div>
                            </div>
                            <TablerMarkdown
                                class='card-body'
                                :markdown='data.description'
                            />

                            <div
                                v-if='data.mission_error'
                                class='card-body bg-red-lt'
                            >
                                <div class='header'>
                                    TAK Server Sync Error
                                </div>

                                <div class='datagrid'>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>
                                            Status
                                        </div>
                                        <div
                                            class='datagrid-content'
                                            v-text='mission_error.status'
                                        />
                                    </div>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>
                                            Code
                                        </div>
                                        <div
                                            class='datagrid-content'
                                            v-text='mission_error.code'
                                        />
                                    </div>
                                    <div class='datagrid-item'>
                                        <div class='datagrid-title'>
                                            Message
                                        </div>
                                        <div
                                            class='datagrid-content'
                                            v-text='mission_error.message'
                                        />
                                    </div>
                                </div>
                            </div>

                            <div class='card-footer'>
                                Last updated <span v-text='timeDiff(data.updated)' />
                            </div>
                        </div>
                    </div>
                    <div class='col-lg-12'>
                        <div class='card'>
                            <div class='row g-0'>
                                <div class='col-12 col-md-3 border-end'>
                                    <div class='card-body'>
                                        <h4 class='subheader'>
                                            Data Sections
                                        </h4>
                                        <div class='list-group list-group-transparent'>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "data-groups",
                                                    "cursor-pointer": $route.name !== "data-groups"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/groups`)'
                                            ><IconAffiliate
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Channels</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "data-files",
                                                    "cursor-pointer": $route.name !== "data-files"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/files`)'
                                            ><IconFiles
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Files</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "data-layer",
                                                    "cursor-pointer": $route.name !== "data-layer"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/layer`)'
                                            ><IconBuildingBroadcastTower
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Layers</span></span>
                                            <span
                                                class='list-group-item list-group-item-action d-flex align-items-center'
                                                :class='{
                                                    "active": $route.name === "data-jobs",
                                                    "cursor-pointer": $route.name !== "data-jobs"
                                                }'
                                                @click='$router.push(`/connection/${$route.params.connectionid}/data/${$route.params.dataid}/jobs`)'
                                            ><IconTransform
                                                :size='32'
                                                :stroke='1'
                                            /><span class='mx-3'>Jobs</span></span>
                                        </div>
                                    </div>
                                </div>
                                <div class='col-12 col-md-9 position-relative'>
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

        <PageFooter />
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import timeDiff from '../timediff.ts';
import {
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
    },
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
    computed: {
        mission_error: function() {
            try {
                return JSON.parse(this.data.mission_error)
            } catch (err) {
                console.error(err)
                return {
                    code: 'Unknown',
                    status: 'Unknown',
                    message: this.data.mission_error
                }
            }
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
            this.connection = await std(`/api/connection/${this.$route.params.connectionid}`);
        },
        fetch: async function() {
            this.loading.data = true;
            this.data = await std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}`);
            this.loading.data = false;
        }
    }
}
</script>
