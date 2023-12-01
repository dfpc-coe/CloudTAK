<template>
<div class='row'>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <CircleArrowLeftIcon @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>BaseMaps</div>
            <div class='btn-list'>
                <PlusIcon @click='$router.push("/basemap/new")' class='cursor-pointer' v-tooltip='"Create BaseMap"'/>
                <RefreshIcon v-if='!loading' @click='fetchList' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>
    <div class='row py-2 px-2'>
        <TablerLoading v-if='loading'/>
        <TablerNone
            v-else-if='!list.basemaps.length'
            label='BaseMaps'
            @create='$router.push("/basemap/new")'
        />
        <template v-else>
            <div :key='basemap.id' v-for='basemap in list.basemaps' class="col-lg-12">
                <div class="d-flex">
                    <a @click='$emit("basemap", basemap)' class="card-title cursor-pointer" v-text='basemap.name'></a>

                    <div class='ms-auto'>
                        <div class='btn-list'>
                            <Share2Icon v-if='false' v-tooltip='"Share BaseMap"' class='cursor-pointer' @click='share(basemap)'/>
                            <SettingsIcon v-tooltip='"Edit Basemap"' class='cursor-pointer' @click='$router.push(`/basemap/${basemap.id}/edit`)'/>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-12">
                <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :current='paging.page'  :total='list.total' :limit='paging.limit'/>
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerNone,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    Share2Icon,
    CircleArrowLeftIcon,
    PlusIcon,
    RefreshIcon,
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
                limit: 30,
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
        CircleArrowLeftIcon,
        Share2Icon,
        SettingsIcon,
        PlusIcon,
        RefreshIcon,
        SearchIcon,
        DownloadIcon,
        TablerLoading,
    }
}
</script>
