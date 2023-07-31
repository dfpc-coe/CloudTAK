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
                                <a @click='$router.push("/layer/new")' class="cursor-pointer btn btn-primary">
                                    New Layer
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
                <div class="col-lg-12">
                    <div class="card">
                        <div class="card-header">
                            <h1 class='card-title'>Layer Admin</h1>
                        </div>
                        <div class='card-body'>
                            <template v-if='loading'>
                                <TablerLoading/>
                            </template>
                            <template v-else>
                                <None
                                    v-if='!list.layers.length'
                                    label='Layers'
                                    @create='$router.push("/layer/new")'
                                />
                                <template v-else>
                                    <TableHeader
                                        v-model:sort='paging.sort'
                                        v-model:order='paging.order'
                                        v-model:header='header'
                                    />
                                    <TableFooter
                                        :limit='paging.limit'
                                        :total='list.total'
                                        @page='paging.page = $event'
                                    />
                                </template>
                            </template>
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
import None from './cards/None.vue';
import Pager from './util/Pager.vue'
import TableHeader from './util/TableHeader.vue'
import TableFooter from './util/TableFooter.vue'
import PageFooter from './PageFooter.vue';
import LayerStatus from './Layer/Status.vue';
import {
    TablerBreadCrumb,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    CloudUploadIcon,
} from 'vue-tabler-icons'

export default {
    name: 'LayerAdmin',
    data: function() {
        return {
            err: false,
            loading: true,
            query: false,
            header: [],
            paging: {
                filter: '',
                sort: 'name',
                order: 'asc',
                limit: 10,
                page: 0
            },
            list: {
                total: 0,
                layers: []
            }
        }
    },
    watch: {
       'paging.page': async function() {
           await this.fetchList();
       },
       'paging.filter': async function() {
           await this.fetchList();
       },
    },
    mounted: async function() {
        await this.listLayerSchema();
        await this.fetchList();
    },
    methods: {
        listLayerSchema: async function() {
            const schema = await window.std('/api/schema?method=GET&url=/layer');
            this.header = ['name', 'cron', 'task'].map((h) => {
                return { name: h, display: true };
            });

            this.header.push(...schema.query.properties.sort.enum.map((h) => {
                return {
                    name: h,
                    display: false
                }
            }).filter((h) => {
                for (const hknown of this.header) {
                    if (hknown.name === h.name) return false;
                }
                return true;
            }));
        },
        timeDiff: function(updated) {
            const msPerMinute = 60 * 1000;
            const msPerHour = msPerMinute * 60;
            const msPerDay = msPerHour * 24;
            const msPerMonth = msPerDay * 30;
            const msPerYear = msPerDay * 365;
            const elapsed = +(new Date()) - updated;

            if (elapsed < msPerMinute) return Math.round(elapsed/1000) + ' seconds ago';
            if (elapsed < msPerHour) return Math.round(elapsed/msPerMinute) + ' minutes ago';
            if (elapsed < msPerDay ) return Math.round(elapsed/msPerHour ) + ' hours ago';
            if (elapsed < msPerMonth) return '~' + Math.round(elapsed/msPerDay) + ' days ago';
            if (elapsed < msPerYear) return '~' + Math.round(elapsed/msPerMonth) + ' months ago';
            return '~' + Math.round(elapsed/msPerYear ) + ' years ago';
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/layer');
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
        CloudUploadIcon,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading,
        TablerMarkdown,
        TableHeader,
        TableFooter,
        LayerStatus
    }
}
</script>
