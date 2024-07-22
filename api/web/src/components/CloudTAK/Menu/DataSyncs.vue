<template>
    <MenuTemplate :name='data ? data.name : "Data Sync Explorer"'>
        <TablerLoading v-if='loading' />
        <template v-else-if='data'>
            <TablerNone
                v-if='!assetList.total'
                label='Files'
                :create='false'
            />
            <div class='modal-body my-2'>
                <div
                    v-for='a in assetList.assets'
                    :key='a.id'
                    class='col-12 py-2 px-3 hover-dark'
                >
                    <div class='col-12 py-2 px-2 d-flex align-items-center'>
                        <IconMapPlus
                            v-if='a.visualized'
                            v-tooltip='"Add to Map"'
                            class='cursor-pointer'
                            :size='32'
                            :stroke='1'
                            @click='createOverlay(a)'
                        />
                        <IconEyeX
                            v-if='!a.visualized'
                            v-tooltip='"No Viz Layer"'
                            :size='32'
                            :stroke='1'
                        />
                        <span
                            class='mx-2 cursor-default'
                            v-text='a.name'
                        />
                    </div>
                </div>
            </div>
        </template>
        <template v-else>
            <TablerNone
                v-if='!list.items.length'
                label='Data'
                @create='$router.push("/data/new")'
            />
            <template v-else>
                <div class='modal-body my-2'>
                    <div
                        v-for='d in list.items'
                        :key='d.id'
                        class='cursor-pointer col-12 py-2 px-3 hover-dark'
                        @click='data = d'
                    >
                        <div class='col-12 py-2 px-2 d-flex align-items-center'>
                            <IconFolder
                                :size='32'
                                :stroke='1'
                            />
                            <span
                                class='mx-2'
                                v-text='d.name'
                            />
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
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import Overlay from '/src/stores/overlays/base.ts';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconFolder,
    IconEyeX,
    IconMapPlus,
} from '@tabler/icons-vue'

export default {
    name: 'CloudTAKDatas',
    components: {
        IconFolder,
        IconEyeX,
        IconMapPlus,
        TablerNone,
        TablerPager,
        TablerLoading,
        MenuTemplate
    },
    emits: [
        'mode'
    ],
    data: function() {
        return {
            err: false,
            loading: true,
            data: null,
            query: false,
            paging: {
                filter: '',
                limit: 30,
                page: 0
            },
            list: {
                total: 0,
                data: []
            },
            assetList: {
                total: 0,
                assets: []
            }
        }
    },
    watch: {
        data: async function() {
            if (this.data) {
                await this.fetchAssetList();
            } else {
                await this.fetchDataList();
            }
       },
       paging: {
            deep: true,
            hander: async function() {
                await this.fethList();
            }
       }
    },
    mounted: async function() {
        await this.fetchDataList();
    },
    methods: {
        createOverlay: async function(asset) {
            this.loading = true;
            const url = stdurl(`/api/connection/${this.data.connection}/data/${this.data.id}/asset/${asset.visualized}/tile`);

            const res = await std(url);

            if (new URL(res.tiles[0]).pathname.endsWith('.mvt')) {
                await mapStore.overlays.push(await Overlay.create(mapStore.map, {
                    url,
                    name: asset.name,
                    mode: 'data',
                    mode_id: asset.name,
                    type: 'vector',
                }));
            } else {
                await mapStore.overlays.push(await Overlay.create(mapStore.map, {
                    url: url,
                    name: asset.name,
                    mode: 'data',
                    mode_id: asset.name,
                    type: 'raster',
                }));
            }

            this.loading = false;
            this.$emit('mode', 'overlays');
            this.$router.push('/menu/overlays');
        },
        fetchDataList: async function() {
            this.loading = true;
            const url = stdurl('/api/data');
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await std(url);
            this.loading = false;
        },
        fetchAssetList: async function() {
            this.loading = true;
            const url = stdurl(`/api/connection/${this.data.connection}/data/${this.data.id}/asset`);
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            const assetList = await std(url);

            const layers = mapStore.map.getLayersOrder();
            for (const asset of assetList.assets) {
                const id = `data-${this.data.id}-${asset.name.replace(/\..*$/, '')}`;
                if (layers.indexOf(id) !== -1) asset.visible = true;
                else asset.visible = false;
            }

            this.assetList = assetList;
            this.loading = false;
        }
    }
}
</script>
