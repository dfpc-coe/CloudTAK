<template>
    <div>
        <MenuTemplate name='Basemaps'>
            <template #buttons>
                <IconPlus
                    v-tooltip='"Create Basemap"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='editModal = {}'
                />
                <IconRefresh
                    v-if='!loading'
                    v-tooltip='"Refresh"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetchList'
                />
            </template>

            <template #default>
                <div class='col-12 px-2 pb-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter'
                    />
                </div>

                <TablerLoading v-if='loading' />
                <TablerNone
                    v-else-if='!list.items.length'
                    label='Basemaps'
                    @create='$router.push("/basemap/new")'
                />
                <template v-else>
                    <div
                        v-for='basemap in list.items'
                        :key='basemap.id'
                        class='col-12 hover-dark cursor-pointer py-2 px-3'
                        @click='setBasemap(basemap)'
                    >
                        <div class='d-flex align-items-center my-2'>
                            <span
                                class='mx-2 text-truncate'
                                style='font-size: 18px;'
                                v-text='basemap.name'
                            />

                            <div class='ms-auto d-flex align-items-center'>
                                <span
                                    v-if='!basemap.username'
                                    class='mx-3 ms-auto badge border bg-blue text-white'
                                >Public</span>
                                <span
                                    v-else
                                    class='mx-3 ms-auto badge border bg-red text-white'
                                >Private</span>

                                <IconSettings
                                    v-if='(!basemap.username && profile.system_admin) || basemap.username'
                                    v-tooltip='"Edit Basemap"'
                                    :size='32'
                                    :stroke='1'
                                    class='cursor-pointer'
                                    @click.stop.prevent='editModal = basemap'
                                />
                            </div>
                        </div>
                    </div>

                    <div class='col-lg-12'>
                        <TablerPager
                            v-if='list.total > paging.limit'
                            :page='paging.page'
                            :total='list.total'
                            :limit='paging.limit'
                            @page='paging.page = $event'
                        />
                    </div>
                </template>
            </template>
        </MenuTemplate>

        <BasemapEditModal
            v-if='editModal'
            size='xl'
            :basemap='editModal'
            @close='editModal = false'
        />
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
        setBasemap: async function(basemap) {
            const hasBasemap = mapStore.overlays.some((overlay) => {
                return overlay.mode === 'basemap';
            });

            if (hasBasemap) {
                for (const overlay of mapStore.overlays) {
                    if (overlay.mode === 'basemap') {
                        await overlay.replace({
                            name: basemap.name,
                            url: `/api/basemap/${basemap.id}/tiles`,
                            mode_id: String(basemap.id)
                        });
                        break;
                    }
                }
            } else {
                mapStore.overlays.unshift(await Overlay.create(mapStore.map, {
                    name: basemap.name,
                    pos: -1,
                    type: 'raster',
                    url: `/api/basemap/${basemap.id}/tiles`,
                    mode: 'basemap',
                    mode_id: basemap.id
                }));
            }
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
        TablerLoading,
        BasemapEditModal,
        MenuTemplate
    }
}
</script>
