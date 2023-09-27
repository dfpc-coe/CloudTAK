<template>
<div class='card'>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Data Assets</h3>

        <div class='ms-auto btn-list'>
            <PlusIcon @click='upload = true' class='cursor-pointer'/>
            <RefreshIcon @click='fetchList' class='cursor-pointer'/>
        </div>
    </div>

    <div v-if='!err && !upload && !loading.list && list.assets.length' class='table-responsive'>
        <table class="table table-vcenter card-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                <tr :key='asset.name' v-for='asset in list.assets'>
                    <td v-text='asset.name'></td>
                    <td>
                        <TablerBytes :bytes='asset.size'/>
                    </td>
                    <td class='d-flex'>
                        <TablerEpoch :date='asset.updated'/>
                        <div class='ms-auto btn-list'>
                            <TrashIcon @click='deleteAsset(asset)' class='cursor-pointer'/>
                            <TransformIcon v-if='!asset.name.endsWith(".pmtiles")' @click='initTransform(asset)' class='cursor-pointer'/>
                            <DownloadIcon @click='downloadAsset(asset)' class='cursor-pointer'/>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div v-else class='card-body'>
        <template v-if='err'>
            <Alert title='Asset Error' :err='err.message' :compact='true'/>
        </template>
        <TablerLoading v-else-if='loading.list'/>
        <Upload
            v-else-if='upload'
            :url='uploadURL()'
            :headers='uploadHeaders()'
            @cancel='upload = false'
            @done='fetchList'
        />
        <TablerNone v-else-if='!list.assets.length' :create='false' :compact='true'/>
    </div>

    <TransformModal v-if='transform.shown' :asset='transform.asset' @close='initTransform'/>
</div>
</template>

<script>
import {
    PlusIcon,
    TrashIcon,
    RefreshIcon,
    DownloadIcon,
    TransformIcon,
} from 'vue-tabler-icons'
import Alert from '../util/Alert.vue';
import TransformModal from './TransformModal.vue';
import Upload from '../util/Upload.vue';
import {
    TablerNone,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataAssets',
    data: function() {
        return {
            err: null,
            upload: false,
            loading: {
                list: true
            },
            transform: {
                shown: false,
                asset: {}
            },
            list: {
                total: 0,
                assets: []
            }
        };
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadURL: function() {
            return window.stdurl(`/api/data/${this.$route.params.dataid}/asset`);
        },
        downloadAsset: async function(asset) {
            const url = window.stdurl(`/api/data/${this.$route.params.dataid}/asset/${asset.name}`);
            url.searchParams.append('token', localStorage.token);
            window.open(url, "_blank")
        },
        initTransform: function(asset) {
            if (!asset) {
                this.transform.asset = {};
                this.transform.shown = false;
            } else {
                this.transform.asset = asset;
                this.transform.shown = true;
            }
        },
        deleteAsset: async function(asset) {
            this.loading.list = true;
            await window.std(`/api/data/${this.$route.params.dataid}/asset/${asset.name}`, {
                method: 'DELETE'
            });

            await this.fetchList();
        },
        fetchList: async function() {
            this.upload = false;

            try {
                this.loading.list = true;
                this.err = false;
                this.list = await window.std(`/api/data/${this.$route.params.dataid}/asset`);
                this.loading.list = false;
                this.$emit('assets', this.list);
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        TablerNone,
        Upload,
        Alert,
        PlusIcon,
        TrashIcon,
        RefreshIcon,
        TransformIcon,
        DownloadIcon,
        TablerLoading,
        TablerBytes,
        TablerEpoch,
        TransformModal
    }
}
</script>
