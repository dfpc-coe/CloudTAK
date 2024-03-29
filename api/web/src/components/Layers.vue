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
                                <a @click='query = !query' class="cursor-pointer btn btn-secondary">
                                    <IconSearch size='32'/>
                                </a>
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
                <div v-if='query' class="col-lg-12">
                    <div class="card">
                        <div class="card-body">
                            <label class="form-label">Layer Search</label>
                            <div class="input-icon mb-3">
                                <input v-model='paging.filter' type="text" class="form-control" placeholder="Search…">
                                <span class="input-icon-addon">
                                    <IconSearch/>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <template v-if='loading'>
                    <TablerLoading/>
                </template>
                <template v-else>
                    <TablerNone
                        v-if='!list.items.length'
                        label='Layers'
                        @create='$router.push("/layer/new")'
                    />
                    <template v-else>
                        <div :key='layer.id' v-for='layer in list.items' class="col-lg-12">
                            <div class="card">
                                <div class="card-header">
                                    <LayerStatus :layer='layer'/>

                                    <a @click='$router.push(`/layer/${layer.id}`)' class="card-title cursor-pointer mx-2" v-text='layer.name'></a>

                                    <div class='ms-auto'>
                                        <div class='btn-list'>
                                            <IconSettings
                                                class='cursor-pointer'
                                                size='32'
                                                v-tooltip='"Edit Layer"' 
                                                @click='$router.push(`/layer/${layer.id}/edit`)'
                                            />
                                        </div>
                                    </div>
                                </div>
                                <TablerMarkdown class="card-body" :markdown='layer.description'/>
                                <div class="card-footer">
                                    Last updated <span v-text='timeDiff(layer.updated)'/>
                                </div>
                            </div>
                        </div>
                        <div class="col-lg-12">
                            <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :page='paging.page'  :total='list.total' :limit='paging.limit'/>
                        </div>
                    </template>
                </template>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import LayerStatus from './Layer/utils/Status.vue';
import timeDiff from '../timediff.js';
import {
    TablerNone,
    TablerPager,
    TablerBreadCrumb, 
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSettings,
    IconSearch
} from '@tabler/icons-vue'

export default {
    name: 'ConnectionLayers',
    data: function() {
        return {
            err: false,
            loading: true,
            query: false,
            paging: {
                filter: '',
                limit: 10,
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            },
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/layer');
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        TablerPager,
        IconSettings,
        IconSearch,
        PageFooter,
        TablerBreadCrumb, 
        TablerLoading,
        TablerMarkdown,
        LayerStatus
    }
}
</script>
