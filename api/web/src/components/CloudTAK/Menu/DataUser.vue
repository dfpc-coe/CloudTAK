<template>
    <MenuTemplate name='User Files'>
        <TablerLoading v-if='loading' />
        <TablerNone
            v-else-if='!assetList.assets.length'
            label='User Uploads'
            @create='$router.push("/profile/files")'
        />
        <template v-else>
            <div
                v-for='a in assetList.assets'
                :key='a.id'
                class='col-12 py-2 px-3 hover-dark'
            >
                <div class='col-12 py-2 px-2 d-flex align-items-center'>
                    <IconMapPlus
                        v-if='a.visualized'
                        v-tooltip='"Add to Map"'
                        @click='createOverlay(a)'
                        class='cursor-pointer'
                        :size='32'
                        :stroke='1'
                    />
                    <IconEyeX
                        v-else-if='!a.visualized'
                        v-tooltip='"No Viz Layer"'
                        :size='32'
                        :stroke='1'
                    />
                    <span
                        class='mx-2 cursor-default'
                        v-text='a.name'
                    />
                    <div class='ms-auto btn-list'>
                        <TablerDelete
                            v-tooltip='"Delete Permanently"'
                            displaytype='icon'
                            @delete='deleteProfileAsset(a)'
                        />
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import { useMapStore } from '/src/stores/map.ts';
import Overlay from '/src/stores/overlays/base.ts';
const mapStore = useMapStore();
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconMapPlus,
    IconEyeX,
} from '@tabler/icons-vue'

export default {
    name: 'CloudTAKDatas',
    components: {
        IconEyeX,
        IconMapPlus,
        TablerNone,
        TablerLoading,
        TablerDelete,
        MenuTemplate
    },
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
            },
        }
    },
    watch: {
       paging: {
            deep: true,
            hander: async function() {
                await this.fethList();
            }
       }
    },
    mounted: async function() {
        await this.fetchUserAssetList();
    },
    methods: {
        deleteProfileAsset: async function(a) {
            this.loading = true;
            const url = stdurl(`/api/profile/asset/${a.name}`);
            await std(url, {
                method: 'DELETE'
            });
            this.fetchUserAssetList();
        },
        createOverlay: async function(asset) {
            const id = `profile-${asset.name.replace(/\..*$/, '')}`;
            const url = stdurl(`/api/profile/asset/${encodeURIComponent(asset.visualized)}/tile`);
            url.searchParams.append('token', localStorage.token);

            this.loading = true;
            const res = await std(url);

            if (new URL(res.tiles[0]).pathname.endsWith('.mvt')) {
                await mapStore.overlays.push(await Overlay.create(mapStore.map, {
                    url,
                    name: asset.name,
                    mode: 'profile',
                    mode_id: asset.name,
                    type: 'vector',
                },{
                    clickable: [
                        { id: `${id}-poly`, type: 'feat' },
                        { id: `${id}-polyline`, type: 'feat' },
                        { id: `${id}-line`, type: 'feat' },
                        { id, type: 'feat' }
                    ]
                }));
            } else {
                await mapStore.overlays.push(await Overlay.create(mapStore.map, {
                    url: url,
                    name: asset.name,
                    mode: 'profile',
                    mode_id: asset.name,
                    type: 'raster',
                }));
            }

            this.loading = false;
            this.$emit('mode', 'overlays');

            this.$router.push('/menu/overlays');
        },
        fetchUserAssetList: async function() {
            this.loading = true;
            const url = stdurl(`/api/profile/asset`);
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            const assetList = await std(url);

            const layers = mapStore.map.getLayersOrder();

            this.assetList = assetList;
            this.loading = false;
        },
    }
}
</script>
