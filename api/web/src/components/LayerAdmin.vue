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

                            <div class='ms-auto btn-list'>
                                <CloudUploadIcon
                                    @click='redeploy'
                                    v-tooltip='"Redeploy"'
                                    width='24' height='24'
                                    class='cursor-pointer'
                                />
                            </div>
                        </div>
                        <template v-if='loading'>
                            <div class='card-body'>
                                <TablerLoading/>
                            </div>
                        </template>
                        <template v-else>
                            <None
                                v-if='!list.layers.length'
                                label='Layers'
                                @create='$router.push("/layer/new")'
                            />
                            <template v-else>
                                <div class='table-responsive'>
                                    <table class="table card-table table-hover table-vcenter datatable">
                                        <TableHeader
                                            v-model:sort='paging.sort'
                                            v-model:order='paging.order'
                                            v-model:header='header'
                                        />
                                        <tbody>
                                            <tr @click='$router.push(`/layer/${layer.id}`)' :key='layer.id' v-for='(layer, layer_it) in list.layers' class='cursor-pointer'>
                                                <template v-for='h in header'>
                                                    <template v-if='h.display'>
                                                        <td>
                                                            <span v-text='layer[h.name]'/>
                                                        </td>
                                                    </template>
                                                </template>
                                            </tr>
                                        </tbody>
                                        <TableFooter
                                            :limit='paging.limit'
                                            :total='list.total'
                                            @page='paging.page = $event'
                                        />
                                    </table>
                                </div>
                            </template>
                        </template>
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
import TableHeader from './util/TableHeader.vue'
import TableFooter from './util/TableFooter.vue'
import PageFooter from './PageFooter.vue';
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
            header: [],
            paging: {
                filter: '',
                sort: 'name',
                order: 'asc',
                limit: 100,
                page: 0
            },
            list: {
                total: 0,
                layers: []
            }
        }
    },
    watch: {
       paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            }
        }
    },
    mounted: async function() {
        await this.listLayerSchema();
        await this.fetchList();
    },
    methods: {
        redeploy: async function(showLoading=true) {
            this.loading = true;
            this.stack = await window.std(`/api/layer/redeploy`, {
                method: 'POST'
            });
            this.loading = false;
        },
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
        CloudUploadIcon,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading,
        TablerMarkdown,
        TableHeader,
        TableFooter,
    }
}
</script>
