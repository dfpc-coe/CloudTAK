<template>
<div>
    <MenuTemplate name='Basemaps'>
        <template #buttons>
            <IconPlus @click='editModal = {}' size='32' class='cursor-pointer' v-tooltip='"Create Basemap"'/>
            <IconSearch @click='query = !query' v-tooltip='"Search"' size='32' class='cursor-pointer'/>
            <IconRefresh v-if='!loading' @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
        </template>

        <template #default>
            <div v-if='query' class='col-12 px-3 pb-3'>
                <TablerInput v-model='paging.filter' placeholder='Filter'/>
            </div>

            <TablerLoading v-if='loading'/>
            <TablerNone
                v-else-if='!list.items.length'
                label='Basemaps'
                @create='$router.push("/basemap/new")'
            />
            <template v-else>
                <div @click='setBasemap(basemap)' :key='basemap.id' v-for='basemap in list.items' class="col-12 hover-dark cursor-pointer py-2 px-3">
                    <div class="d-flex align-items-center my-2">
                        <span class='mx-2 text-truncate' style='font-size: 18px;' v-text='basemap.name'/>

                        <div class='ms-auto d-flex align-items-center'>
                            <span v-if='!basemap.username' class='mx-3 ms-auto badge border bg-blue text-white'>Public</span>
                            <span v-else='!basemap.username' class='mx-3 ms-auto badge border bg-red text-white'>Private</span>

                            <IconSettings
                                v-if='(!basemap.username && profile.system_admin) || basemap.username'
                                v-tooltip='"Edit Basemap"'
                                size='32'
                                class='cursor-pointer'
                                @click.stop.prevent='editModal = basemap'
                            />
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                    <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :page='paging.page'  :total='list.total' :limit='paging.limit'/>
                </div>
            </template>
        </template>
    </MenuTemplate>

    <BasemapEditModal v-if='editModal' size='xl' :basemap='editModal' @close='editModal = false' />
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import BasemapEditModal from './Basemaps/EditModal.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerInput,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRefresh,
    IconSettings,
    IconSearch
} from '@tabler/icons-vue'
import { mapState } from 'pinia'
import { useMapStore } from '/src/stores/map.ts';
import { useProfileStore } from '/src/stores/profile.ts';
const mapStore = useMapStore();

export default {
    name: 'CloudTAKBaseMaps',
    data: function() {
        return {
            err: false,
            loading: true,
            query: false,
            editModal: false,
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
        editModal: async function() {
            await this.fetchList();
        },
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
                before: mapStore.layers[0].name,
                type: 'raster',
                source: 'basemap',
                layers: [{
                    id: 'basemap',
                    type: 'raster',
                    source: 'basemap',
                    minzoom: basemap.minzoom,
                    maxzoom: basemap.maxzoom
                }]
            });
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
        IconSettings,
        IconPlus,
        IconRefresh,
        IconSearch,
        TablerLoading,
        BasemapEditModal,
        MenuTemplate
    }
}
</script>
