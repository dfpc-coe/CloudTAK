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
                <div class="col-12">
                    <div class="card">
                        <div class="card-body">
                            <div class='row g-2'>
                                <div class='col-12'>
                                    <label class="form-label">BaseMap Search</label>
                                    <div class="input-icon mb-3">
                                        <input v-model='paging.filter' type="text"  class="form-control" placeholder="Search…">
                                        <span class="input-icon-addon"><IconSearch/></span>
                                    </div>
                                </div>
                                <div class='col-12'>
                                    <TablerEnum v-model='paging.type' :options='["Any", "Raster", "Raster-DEM", "Vector"]'/>
                                </div>
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
                        <div :key='basemap.id' v-for='basemap in list.basemaps' class="col-md-12">
                            <div class="card">
                                <div class="card-header">
                                    <BaseMapBadge :type='basemap.type'/>
                                    <a @click='$router.push(`/basemap/${basemap.id}`)' class="card-title cursor-pointer" v-text='basemap.name'></a>

                                    <div class='ms-auto'>
                                        <div class='btn-list'>
                                            <IconShare2 v-tooltip='"Share BaseMap"' class='cursor-pointer' @click='share(basemap)'/>
                                            <IconDownload v-tooltip='"Download TAK XML"' class='cursor-pointer' @click='download(basemap)'/>
                                            <IconSettings v-tooltip='"Edit Basemap"' class='cursor-pointer' @click='$router.push(`/basemap/${basemap.id}/edit`)'/>
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
                            <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :page='paging.page'  :total='list.total' :limit='paging.limit'/>
                        </div>
                    </template>
                </template>
            </div>
        </div>
    </div>
    <PageFooter/>

    <GroupSelectModal
        v-if='shareModal.shown'
        @close='shareModal.shown = false'
        :item='shareModal.basemap'
        :disabled='true'
    />
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import BaseMapLocation from './BaseMap/Location.vue';
import {
    TablerNone,
    TablerEnum,
    TablerPager,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import BaseMapBadge from './BaseMap/Badge.vue';
import timeDiff from '../timediff.js';
import GroupSelectModal from './util/GroupSelectModal.vue';
import {
    IconShare2,
    IconSettings,
    IconDownload,
    IconSearch
} from '@tabler/icons-vue'

export default {
    name: 'BaseMaps',
    data: function() {
        return {
            err: false,
            loading: true,
            shareModal: {
                shown: false,
                basemap: null
            },
            paging: {
                filter: '',
                type: 'Any',
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
       paging: {
            deep: true,
            handler: async function() {
               await this.fetchList();
           },
       }
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
            if (this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            if (this.paging.type !== 'Any') url.searchParams.append('type', this.paging.type.toLowerCase());
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        TablerEnum,
        TablerPager,
        IconShare2,
        IconSettings,
        IconSearch,
        PageFooter,
        IconDownload,
        TablerBreadCrumb,
        GroupSelectModal,
        TablerLoading,
        BaseMapLocation,
        BaseMapBadge
    }
}
</script>
