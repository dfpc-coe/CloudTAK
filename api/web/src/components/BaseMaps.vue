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
                                    <SearchIcon/>
                                </a>

                                <a @click='$router.push("/basemap/new")' class="cursor-pointer btn btn-primary">
                                    New BaseMap
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
                            <label class="form-label">BaseMap Search</label>
                            <div class="input-icon mb-3">
                                <input v-model='paging.filter' type="text"  class="form-control" placeholder="Search…">
                                <span class="input-icon-addon">
                                    <SearchIcon/>
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
                        v-if='!list.basemaps.length'
                        label='BaseMaps'
                        @create='$router.push("/basemap/new")'
                    />
                    <template v-else>
                        <div :key='basemap.id' v-for='basemap in list.basemaps' class="col-lg-12">
                            <div class="card">
                                <div class="card-header">
                                    <a @click='$router.push(`/basemap/${basemap.id}`)' class="card-title cursor-pointer" v-text='basemap.name'></a>

                                    <div class='ms-auto'>
                                        <div class='btn-list'>
                                            <Share2Icon v-tooltip='"Share BaseMap"' class='cursor-pointer' @click='share(basemap)'/>
                                            <DownloadIcon v-tooltip='"Download TAK XML"' class='cursor-pointer' @click='download(basemap)'/>
                                            <SettingsIcon v-tooltip='"Edit Basemap"' class='cursor-pointer' @click='$router.push(`/basemap/${basemap.id}/edit`)'/>
                                        </div>
                                    </div>
                                </div>
                                <div class="card-body">
                                    <BaseMapLocation :basemap='basemap'/>
                                </div>
                                <div class="card-footer">
                                    <span v-text='`Last Updated: ${timeDiff(basemap.updated)}`'/>
                                </div>
                            </div>
                        </div>

                        <div class="col-lg-12">
                            <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :current='paging.page'  :total='list.total' :limit='paging.limit'/>
                        </div>
                    </template>
                </template>
            </div>
        </div>
    </div>
    <PageFooter/>

    <ShareModal
        v-if='shareModal.shown'
        @close='shareModal.shown = false'
        :item='shareModal.basemap'
    />
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import BaseMapLocation from './BaseMap/Location.vue';
import {
    TablerNone,
    TablerPager,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import timeDiff from '../timediff.js';
import ShareModal from './util/ShareModal.vue';
import {
    Share2Icon,
    SettingsIcon,
    DownloadIcon,
    SearchIcon
} from 'vue-tabler-icons'

export default {
    name: 'BaseMaps',
    data: function() {
        return {
            err: false,
            loading: true,
            query: false,
            shareModal: {
                shown: false,
                basemap: null
            },
            paging: {
                filter: '',
                limit: 10,
                page: 0
            },
            list: {
                total: 0,
                basemaps: []
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    watch: {
       'paging.page': async function() {
           await this.fetchList();
       },
       'paging.filter': async function() {
           await this.fetchList();
       },
    },
    methods: {
        share: function(basemap) {
            this.shareModal.basemap = basemap;
            this.shareModal.shown = true;
        },
        timeDiff(update) {
            return timeDiff(update);
        },
        download: async function(basemap) {
            window.location.href = window.stdurl(`api/basemap/${basemap.id}?format=xml&download=true&token=${localStorage.token}`);
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/basemap');
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        TablerPager,
        Share2Icon,
        SettingsIcon,
        SearchIcon,
        PageFooter,
        DownloadIcon,
        TablerBreadCrumb,
        ShareModal,
        TablerLoading,
        BaseMapLocation
    }
}
</script>
