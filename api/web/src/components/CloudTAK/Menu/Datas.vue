<template>
<div class='row'>
    <div class='col-12 border-light border-bottom'>
        <div class='card-header my-2'>
            <div class='card-title mx-2'>Data Explorer</div>
        </div>
    </div>

    <TablerLoading v-if='loading'/>
    <template v-if='data'>
        <div :key='a.id' v-for='a in assetList.assets' class="col-lg-12">
            <div class='col-12 py-2 px-2 d-flex align-items-center'>
                <EyeXIconIcon v-if='!a.visualized' v-tooltip='"No Viz Layer"'/>
                <EyeIcon v-else-if='a.visible' @click='flipVisible(a)' class='cursor-pointer'/>
                <EyeOffIcon v-else @click='flipVisible(a)' class='cursor-pointer'/>
                <span class="mx-2 cursor-pointer" v-text='a.name'></span>
            </div>
        </div>
    </template>
    <template v-else>
        <TablerNone
            v-if='!list.data.length'
            label='Data'
            @create='$router.push("/data/new")'
        />
        <template v-else>
            <div :key='d.id' v-for='d in list.data' class="col-lg-12">
                <div class='col-12 py-2 px-2 d-flex align-items-center'>
                    <span @click='data = d' class="cursor-pointer" v-text='d.name'></span>
                </div>
            </div>

            <div class="col-lg-12">
                <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :page='paging.page'  :total='list.total' :limit='paging.limit'/>
            </div>
        </template>
    </template>
</div>
</template>

<script>
import {
    TablerNone,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    EyeIcon,
    EyeXIcon,
    EyeOffIcon,
    SettingsIcon,
    SearchIcon
} from 'vue-tabler-icons'

export default {
    name: 'Datas',
    props: {
        map: {
            type: Object,
            required: true
        }
    },
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
    mounted: async function() {
        await this.fetchList();
    },
    watch: {
       'data': async function() {
            if (this.data) {
                await this.fetchAssetList();
            } else {
                await this.fetchList();
            }
       },
       'paging.page': async function() {
           await this.fetchList();
       },
       'paging.filter': async function() {
           await this.fetchList();
       },
    },
    methods: {
        flipVisible: function(a) {
            const id = `data-${this.data.id}-${a.name.replace(/\..*$/, '')}`;

            if (a.visible) {
                this.map.removeLayer(id);
                this.map.removeSource(id);
                a.visible = false;
            } else {
                const url = window.stdurl(`/api/data/${this.data.id}/asset/${a.visualized}/tile`);
                url.searchParams.append('token', localStorage.token);

                this.map.addSource(id, { type: 'raster', tileSize: 256, url: String(url) });
                this.map.addLayer({ id, 'type': 'raster', 'source': id }, 'cots');

                a.visible = true;
            }
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/data');
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            this.list = await window.std(url);
            this.loading = false;
        },
        fetchAssetList: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/data/${this.data.id}/asset`);
            if (this.query && this.paging.filter) url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            const assetList = await window.std(url);

            const layers = this.map.getLayersOrder();
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
        EyeIcon,
        EyeXIcon,
        EyeOffIcon,
        TablerNone,
        TablerPager,
        SettingsIcon,
        SearchIcon,
        TablerLoading,
    }
}
</script>
