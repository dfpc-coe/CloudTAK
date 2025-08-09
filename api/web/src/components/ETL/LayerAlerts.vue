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
                            <div class='card-header d-flex'>
                                <h1 class='card-title'>
                                    Layer Alerts
                                </h1>
                                <div class='ms-auto btn-list'>
                                    <IconTrash
                                        :size='32'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click='deleteAlerts()'
                                    />
                                    <IconRefresh
                                        :size='32'
                                        stroke='1'
                                        class='cursor-pointer'
                                        @click='query'
                                    />
                                </div>
                            </div>

                            <TablerLoading
                                v-if='loading.alerts'
                                desc='Loading Alerts'
                            />
                            <TablerNone
                                v-else-if='!list.total'
                                :create='false'
                            />
                            <div v-else>
                                <div
                                    v-for='alert in list.items'
                                    :key='alert.id'
                                    class='hover'
                                >
                                    <div class='row px-3 py-2'>
                                        <div class='d-flex'>
                                            <span
                                                class='subheader'
                                                v-text='alert.title'
                                            />
                                            <div class='ms-auto'>
                                                <span
                                                    class='subheader'
                                                    v-text='alert.updated'
                                                />
                                            </div>
                                        </div>
                                        <div class='d-flex'>
                                            <div
                                                class='mx-2'
                                                :class='{
                                                    "text-green": alert.priority === "green",
                                                    "text-yellow": alert.priority === "yellow",
                                                    "text-red": alert.priority === "red"
                                                }'
                                            >
                                                <IconAlertCircle
                                                    :size='32'
                                                    stroke='1'
                                                    class='mx-auto my-auto'
                                                />
                                            </div>
                                            <span v-text='alert.description' />
                                            <div class='ms-auto my-1'>
                                                <IconTrash
                                                    :size='32'
                                                    stroke='1'
                                                    class='cursor-pointer'
                                                    @click='deleteAlerts(alert.id)'
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class='col-lg-12 d-flex px-3 py-3 d-flex'>
                                <div class='ms-auto'>
                                    <TablerPager
                                        v-if='list.total > paging.limit'
                                        :page='paging.page'
                                        :total='list.total'
                                        :limit='paging.limit'
                                        @page='paging.page = $event'
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
import { std, stdurl } from '../../std.ts';
import PageFooter from '../PageFooter.vue';
import {
    IconTrash,
    IconRefresh,
    IconAlertCircle,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerPager,
    TablerLoading,
    TablerBreadCrumb,
} from '@tak-ps/vue-tabler'

export default {
    name: 'LayerAlerts',
    components: {
        TablerNone,
        TablerPager,
        PageFooter,
        IconTrash,
        IconRefresh,
        TablerBreadCrumb,
        TablerLoading,
        IconAlertCircle,
    },
    data: function() {
        return {
            paging: {
                limit: 20,
                page: 0,
                filter: ''
            },
            loading: {
                alerts: true
            },
            list: {
                alerts: []
            }
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.query();
            }
        }
    },
    mounted: async function() {
        await this.query();
    },
    methods: {
        query: async function() {
            this.loading.alerts = true;
            const url = stdurl(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/alert`);
            url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading.alerts = false;
        },
        deleteAlerts: async function(id) {
            this.loading.alerts = true;
            if (id) {
                await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/alert/${id}`, {
                    method: 'DELETE'
                });
            } else {
                await std(`/api/connection/${this.$route.params.connectionid}/layer/${this.$route.params.layerid}/alert`, {
                    method: 'DELETE'
                });
            }
            await this.query();
        }
    }
}
</script>
