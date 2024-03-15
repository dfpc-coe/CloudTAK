<template>
<div>
    <div class='card-header d-flex'>
        <h3 class='card-title'>Data Assets</h3>

        <div class='ms-auto btn-list'>
            <IconPlus @click='upload = true' size='32' class='cursor-pointer' v-tooltip='"Upload"'/>
            <IconRefresh @click='fetchList' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
        </div>
    </div>

    <div v-if='!err && !upload && !loading.list && list.assets.length' class='table-responsive'>
        <table class="table table-hover table-vcenter card-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                <tr :key='asset.name' v-for='asset in list.assets'>
                    <td>
                        <div class='d-flex align-items-center'>
                            <div class='btn-list'>
                                <IconMap v-if='asset.visualized' v-tooltip='"Visualizable"' size='32'/>
                                <IconMapOff v-else v-tooltip='"Not Cloud Optimized"' size='32'/>
                            </div>

                            <span v-text='asset.name' class='mx-2'/>

                            <IconRefreshDot v-if='data.mission_sync && asset.sync' size='32' class='text-green' v-tooltip='"Syncing"'/>
                            <IconRefreshOff v-else-if='data.mission_sync && !asset.sync' size='32'/>
                        </div>
                    </td>
                    <td>
                        <TablerBytes :bytes='asset.size'/>
                    </td>
                    <td class='d-flex'>
                        <TablerEpoch :date='asset.updated'/>
                        <div class='ms-auto btn-list'>
                            <TablerDelete displaytype='icon' @delete='deleteAsset(asset)' v-tooltip='"Delete Asset"'/>
                            <IconTransform v-if='!asset.visualized' @click='initTransform(asset)' v-tooltip='"Convert Asset"' size='32' class='cursor-pointer'/>
                            <IconDownload @click='downloadAsset(asset)' size='32' class='cursor-pointer' v-tooltip='"Download Asset"'/>
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
    IconRefreshDot,
    IconRefreshOff,
    IconPlus,
    IconMap,
    IconMapOff,
    IconRefresh,
    IconDownload,
    IconTransform,
} from '@tabler/icons-vue'
import Alert from '../util/Alert.vue';
import TransformModal from './TransformModal.vue';
import Upload from '../util/Upload.vue';
import {
    TablerNone,
    TablerDelete,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';

export default {
    name: 'DataFiles',
    props: {
        data: {
            type: Object,
            required: true
        }
    },
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
            return window.stdurl(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/asset`);
        },
        downloadAsset: async function(asset) {
            const url = window.stdurl(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/asset/${asset.name}`);
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
            await window.std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/asset/${asset.name}`, {
                method: 'DELETE'
            });

            await this.fetchList();
        },
        fetchList: async function() {
            this.upload = false;

            try {
                this.loading.list = true;
                this.err = false;
                this.list = await window.std(`/api/connection/${this.$route.params.connectionid}/data/${this.$route.params.dataid}/asset`);
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
        IconPlus,
        IconMap,
        IconMapOff,
        IconRefresh,
        IconTransform,
        IconRefreshDot,
        IconRefreshOff,
        IconDownload,
        TablerDelete,
        TablerLoading,
        TablerBytes,
        TablerEpoch,
        TransformModal
    }
}
</script>
