<template>
<div>
    <div class='col-12 border-bottom border-light'>
        <div class='modal-header px-0 mx-2'>
            <IconCircleArrowLeft @click='$emit("close")' class='cursor-pointer'/>
            <div class='modal-title'>Data Explorer</div>
            <div/>
        </div>
    </div>

    <div class='mx-4'>
        <div class="btn-group w-100 py-2" role="group">
            <input @change="mode = 'data'" :checked='mode === "data"' value='data' type="radio" class="btn-check" name="mode-select" id="data" autocomplete="off">
            <label for="data" class="btn btn-icon" v-tooltip='"Data Store"'>
                <IconDatabase/>
            </label>
            <input @change="mode = 'user'" :checked='mode === "user"' value='user' type="radio" class="btn-check" name="mode-select" id="user" autocomplete="off">
            <label for="user" class="btn btn-icon" v-tooltip='"User Files"'>
                <IconUser/>
            </label>
        </div>
    </div>

    <TablerLoading v-if='loading'/>
    <template v-else-if='mode === "user"'>
        <TablerNone
            v-if='!assetList.assets.length'
            label='User Uploads'
            @create='$router.push("/profile/files")'
        />
        <template v-else>
            <div :key='a.id' v-for='a in assetList.assets' class="cursor-pointer col-12 py-2 px-3 hover-dark">
                <div class='col-12 py-2 px-2 d-flex align-items-center'>
                    <IconEyeX v-if='!a.visualized' v-tooltip='"No Viz Layer"'/>
                    <IconEye v-else-if='a.visible' @click='flipVisible(a)' class='cursor-pointer'/>
                    <IconEyeOff v-else @click='flipVisible(a)' class='cursor-pointer'/>
                    <span class="mx-2 cursor-pointer" v-text='a.name'></span>
                    <div class='ms-auto btn-list'>
                        <TablerDelete displaytype='icon' @delete='deleteProfileAsset(a)'/>
                    </div>
                </div>
            </div>
        </template>
    </template>
    <template v-else-if='mode === "data"'>
        <template v-if='data'>
            <div class='col-12 d-flex mx-2 py-2'>
                <IconCircleArrowLeft @click='data = null' class='cursor-pointer'/>
                <div class='modal-title mx-2' v-text='data.name'></div>
            </div>

            <div class='modal-body my-2'>
                <div :key='a.id' v-for='a in assetList.assets' class='cursor-pointer col-12 py-2 px-3 hover-dark'>
                    <div class='col-12 py-2 px-2 d-flex align-items-center'>
                        <IconEyeX v-if='!a.visualized' v-tooltip='"No Viz Layer"'/>
                        <IconEye v-else-if='a.visible' @click='flipVisible(a)' class='cursor-pointer'/>
                        <IconEyeOff v-else @click='flipVisible(a)' class='cursor-pointer'/>
                        <span class="mx-2 cursor-pointer" v-text='a.name'></span>
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
                    <div @click='data = d' :key='d.id' v-for='d in list.items' class='cursor-pointer col-12 py-2 px-3 hover-dark'>
                        <div class='col-12 py-2 px-2 d-flex align-items-center'>
                            <IconFolder/><span class="mx-2" v-text='d.name'></span>
                        </div>
                    </div>
                    <div class="col-lg-12">
                        <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :page='paging.page'  :total='list.total' :limit='paging.limit'/>
                    </div>
                </div>
            </template>
        </template>
    </template>
</div>
</template>

<script>
import { useMapStore } from '/src/stores/map.js';
const mapStore = useMapStore();

import {
    TablerNone,
    TablerPager,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconDatabase,
    IconUser,
    IconFolder,
    IconEye,
    IconEyeX,
    IconEyeOff,
    IconSettings,
    IconSearch,
    IconCircleArrowLeft
} from '@tabler/icons-vue'

export default {
    name: 'Datas',
    data: function() {
        return {
            mode: 'data',
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
    mounted: async function() {
        await this.fetchDataList();
    },
    watch: {
        mode: async function() {
            if (this.mode === 'user') {
                this.data = false;
                await this.fetchUserAssetList();
            } else if (this.data) {
                await this.fetchAssetList();
            } else {
                await this.fetchDataList();
            }
        },
        data: async function() {
            if (this.mode !== 'data') return
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
    methods: {
        flipVisible: async function(a) {
            if (this.mode === 'user') {
                const id = `profile-${a.name.replace(/\..*$/, '')}`;
                if (a.visible) {
                    mapStore.map.removeLayer(id);
                    mapStore.map.removeSource(id);
                    a.visible = false;
                } else {
                    a.visible = true;
                    const url = window.stdurl(`/api/profile/asset/${encodeURIComponent(a.visualized)}/tile`);
                    url.searchParams.append('token', localStorage.token);

                    await this.createOverlay(id, url, a);
                }
            } else {
                const id = `data-${this.data.id}-${a.name.replace(/\..*$/, '')}`;
                if (a.visible) {
                    mapStore.map.removeLayer(id);
                    mapStore.map.removeSource(id);
                    a.visible = false;
                } else {
                    a.visible = true;
                    const url = window.stdurl(`/api/connection/${this.data.connection}/data/${this.data.id}/asset/${a.visualized}/tile`);
                    url.searchParams.append('token', localStorage.token);

                    await this.createOverlay(id, url, a)
                }
            }
        },
        deleteProfileAsset: async function(a) {
            this.loading = true;
            const url = window.stdurl(`/api/profile/asset/${a.name}`);
            await window.std(url, {
                method: 'DELETE'
            });
            this.fetchUserAssetList();
        },
        createOverlay: async function(id, url, a) {
            this.loading = true;
            const res = await window.std(url);

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
        fetchDataList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/data');
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await window.std(url);
            this.loading = false;
        },
        fetchUserAssetList: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/profile/asset`);
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            const assetList = await window.std(url);

            const layers = mapStore.map.getLayersOrder();
            for (const asset of assetList.assets) {
                const id = `profile-${asset.name.replace(/\..*$/, '')}`;
                if (layers.indexOf(id) !== -1) asset.visible = true;
                else asset.visible = false;
            }

            this.assetList = assetList;
            this.loading = false;
        },
        fetchAssetList: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/connection/${this.data.connection}/data/${this.data.id}/asset`);
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            const assetList = await window.std(url);

            const layers = mapStore.map.getLayersOrder();
            for (const asset of assetList.assets) {
                const id = `data-${this.data.id}-${asset.name.replace(/\..*$/, '')}`;
                if (layers.indexOf(id) !== -1) asset.visible = true;
                else asset.visible = false;
            }

            this.assetList = assetList;
            this.loading = false;
        }
    },
    components: {
        IconUser,
        IconDatabase,
        IconFolder,
        IconEye,
        IconEyeX,
        IconEyeOff,
        TablerNone,
        TablerPager,
        IconSettings,
        IconSearch,
        TablerLoading,
        TablerDelete,
        IconCircleArrowLeft
    }
}
</script>
