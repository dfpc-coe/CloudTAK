<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$router.back()' size='32' class='cursor-pointer'/>
            <div class='modal-title'>BaseMaps</div>
            <div class='btn-list'>
                <IconPlus @click='$router.push("/basemap/new")' size='32' class='cursor-pointer' v-tooltip='"Create BaseMap"'/>
                <IconSearch @click='query = !query' v-tooltip='"Search"' size='32' class='cursor-pointer'/>
                <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
            </div>
        </div>
    </div>

    <div v-if='query' class='col-12 px-3'>
        <TablerInput v-model='paging.filter' placeholder='Filter'/>
    </div>

    <TablerLoading v-if='loading'/>
    <TablerNone
        v-else-if='!list.items.length'
        label='BaseMaps'
        @create='$router.push("/basemap/new")'
    />
    <template v-else>
        <div @click='setBasemap(basemap)' :key='basemap.id' v-for='basemap in list.items' class="col-12 hover-dark cursor-pointer py-2 px-3">
            <div class="d-flex align-items-center my-2">
                <span class='mx-2' style='font-size: 18px;' v-text='basemap.name'/>

                <div class='ms-auto btn-list'>
                    <IconSettings
                        v-if='(!basemap.username && profile.system_admin) || basemap.username'
                        v-tooltip='"Edit Basemap"'
                        size='32'
                        class='cursor-pointer'
                        @click.stop.prevent='$router.push(`/basemap/${basemap.id}/edit`)'
                    />
                </div>
            </div>
        </div>

        <div class="col-lg-12">
            <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :page='paging.page'  :total='list.total' :limit='paging.limit'/>
        </div>
    </template>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerInput,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconShare2,
    IconCircleArrowLeft,
    IconPlus,
    IconRefresh,
    IconSettings,
    IconDownload,
    IconSearch
} from '@tabler/icons-vue'
import { mapState } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
import { useProfileStore } from '/src/stores/profile.js';
const profileStore = useProfileStore();
const mapStore = useMapStore();

export default {
    name: 'BaseMaps',
    data: function() {
        return {
            err: false,
            loading: true,
            query: false,
            paging: {
                filter: '',
                limit: 30,
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    computed: {
        ...mapState(useProfileStore, ['profile']),
    },
    watch: {
        query: function() {
            if (!this.query) this.paging.filter = '';
        },
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            },
        }
    },
    methods: {
        setBasemap: function(basemap) {
            mapStore.removeLayerBySource('basemap')

            const url = String(stdurl(`/api/basemap/${basemap.id}/tiles/`)) + `{z}/{x}/{y}?token=${localStorage.token}`;
            mapStore.map.addSource('basemap', { type: 'raster', tileSize: 256, tiles: [ url ] });
            mapStore.addLayer({
                name: basemap.name,
                before: 'CoT Icons',
                type: 'raster',
                source: 'basemap',
            }, [{
                id: 'basemap',
                type: 'raster',
                source: 'basemap',
                minzoom: basemap.minzoom,
                maxzoom: basemap.maxzoom
            }]);
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/basemap');
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
        TablerInput,
        IconCircleArrowLeft,
        IconShare2,
        IconSettings,
        IconPlus,
        IconRefresh,
        IconSearch,
        IconDownload,
        TablerLoading,
    }
}
</script>
