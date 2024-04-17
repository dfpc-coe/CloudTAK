<template>
<MenuTemplate name='User Files'>
    <TablerLoading v-if='loading'/>
    <TablerNone
        v-else-if='!assetList.assets.length'
        label='User Uploads'
        @create='$router.push("/profile/files")'
    />
    <template v-else>
        <div :key='a.id' v-for='a in assetList.assets' class="cursor-pointer col-12 py-2 px-3 hover-dark">
            <div class='col-12 py-2 px-2 d-flex align-items-center'>
                <IconEyeX v-if='!a.visualized' v-tooltip='"No Viz Layer"' size='32'/>
                <IconEye v-else-if='a.visible' @click='flipVisible(a)' size='32' class='cursor-pointer'/>
                <IconEyeOff v-else @click='flipVisible(a)' size='32' class='cursor-pointer'/>
                <span class="mx-2 cursor-pointer" v-text='a.name'></span>
                <div class='ms-auto btn-list'>
                    <TablerDelete displaytype='icon' @delete='deleteProfileAsset(a)'/>
                </div>
            </div>
        </div>
    </template>
</MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import { useMapStore } from '/src/stores/map.ts';
const mapStore = useMapStore();
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconEye,
    IconEyeX,
    IconEyeOff,
} from '@tabler/icons-vue'

export default {
    name: 'CloudTAKDatas',
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
    mounted: async function() {
        await this.fetchUserAssetList();
    },
    watch: {
       paging: {
            deep: true,
            hander: async function() {
                await this.fethList();
            }
       }
    },
    methods: {
        flipVisible: async function(a) {
            const id = `profile-${a.name.replace(/\..*$/, '')}`;
            if (a.visible) {
                mapStore.map.removeLayer(id);
                mapStore.map.removeSource(id);
                a.visible = false;
            } else {
                a.visible = true;
                const url = stdurl(`/api/profile/asset/${encodeURIComponent(a.visualized)}/tile`);
                url.searchParams.append('token', localStorage.token);

                await this.createOverlay(id, url, a);
            }

            this.$router.push('/menu/overlays');
        },
        deleteProfileAsset: async function(a) {
            this.loading = true;
            const url = stdurl(`/api/profile/asset/${a.name}`);
            await std(url, {
                method: 'DELETE'
            });
            this.fetchUserAssetList();
        },
        createOverlay: async function(id, url) {
            this.loading = true;
            const res = await std(url);

            if (new URL(res.tiles[0]).pathname.endsWith('.mvt')) {
                await mapStore.addDefaultLayer({
                    id,
                    url: url,
                    name: id,
                    source: id,
                    type: 'vector',
                    before: 'CoT Icons',
                    clickable: [
                        { id: `${id}-poly`, type: 'feat' },
                        { id: `${id}-polyline`, type: 'feat' },
                        { id: `${id}-line`, type: 'feat' },
                        { id: id, type: 'feat' }
                    ]
                });
            } else {
                await mapStore.addDefaultLayer({
                    id,
                    url: url,
                    name: id,
                    source: id,
                    type: 'raster',
                    before: 'CoT Icons',
                    clickable: [
                        { id: `${id}-poly`, type: 'feat' },
                        { id: `${id}-polyline`, type: 'feat' },
                        { id: `${id}-line`, type: 'feat' },
                        { id: id, type: 'feat' }
                    ]
                });
            }

            this.loading = false;
            this.$emit('mode', 'overlays');
        },
        fetchUserAssetList: async function() {
            this.loading = true;
            const url = stdurl(`/api/profile/asset`);
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            const assetList = await std(url);

            const layers = mapStore.map.getLayersOrder();
            for (const asset of assetList.assets) {
                const id = `profile-${asset.name.replace(/\..*$/, '')}`;
                if (layers.indexOf(id) !== -1) asset.visible = true;
                else asset.visible = false;
            }

            this.assetList = assetList;
            this.loading = false;
        },
    },
    components: {
        IconEye,
        IconEyeX,
        IconEyeOff,
        TablerNone,
        TablerLoading,
        TablerDelete,
        MenuTemplate
    }
}
</script>
