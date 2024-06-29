<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                User Assets
            </h3>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"Upload"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='upload = true'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetchList'
                />
            </div>
        </div>

        <div
            v-if='!err && !upload && !loading.list && list.assets.length'
            class='table-responsive'
        >
            <table class='table table-hover table-vcenter card-table'>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Size</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='asset in list.assets'
                        :key='asset.name'
                    >
                        <td>
                            <div class='d-flex align-items-center'>
                                <div class='btn-list'>
                                    <IconMap
                                        v-if='asset.visualized'
                                        v-tooltip='"Visualizable"'
                                        :size='32'
                                        :stroke='1'
                                    />
                                    <IconMapOff
                                        v-else
                                        v-tooltip='"Not Cloud Optimized"'
                                        :size='32'
                                        :stroke='1'
                                    />
                                </div>

                                <span
                                    class='mx-2'
                                    v-text='asset.name'
                                />
                            </div>
                        </td>
                        <td>
                            <TablerBytes :bytes='asset.size' />
                        </td>
                        <td class='d-flex align-items-center'>
                            <TablerEpoch :date='asset.updated' />
                            <div class='ms-auto btn-list'>
                                <TablerDelete
                                    v-tooltip='"Delete Asset"'
                                    displaytype='icon'
                                    @delete='deleteAsset(asset)'
                                />
                                <IconTransform
                                    v-if='!asset.visualized'
                                    v-tooltip='"Convert Asset"'
                                    :size='32'
                                    :stroke='1'
                                    class='cursor-pointer'
                                    @click='initTransform(asset)'
                                />
                                <IconDownload
                                    v-tooltip='"Download Asset"'
                                    :size='32'
                                    :stroke='1'
                                    class='cursor-pointer'
                                    @click='downloadAsset(asset)'
                                />
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div
            v-else
            class='card-body'
        >
            <template v-if='err'>
                <TablerAlert
                    title='Asset Error'
                    :err='err'
                    :compact='true'
                />
            </template>
            <TablerLoading v-else-if='loading.list' />
            <Upload
                v-else-if='upload'
                :url='uploadURL()'
                :headers='uploadHeaders()'
                @cancel='upload = false'
                @done='fetchList'
            />
            <TablerNone
                v-else-if='!list.assets.length'
                :create='false'
                :compact='true'
            />
        </div>

        <TransformModal
            v-if='transform.shown'
            :asset='transform.asset'
            @close='initTransform'
        />
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconPlus,
    IconMap,
    IconMapOff,
    IconRefresh,
    IconDownload,
    IconTransform,
} from '@tabler/icons-vue'
import TransformModal from './TransformModal.vue';
import Upload from '../util/Upload.vue';
import {
    TablerAlert,
    TablerNone,
    TablerDelete,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';

export default {
    name: 'ProfileFiles',
    components: {
        TablerNone,
        Upload,
        TablerAlert,
        IconPlus,
        IconMap,
        IconMapOff,
        IconRefresh,
        IconTransform,
        IconDownload,
        TablerDelete,
        TablerLoading,
        TablerBytes,
        TablerEpoch,
        TransformModal
    },
    emits: [
        'assets'
    ],
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
            return stdurl(`/api/profile/asset`);
        },
        downloadAsset: async function(asset) {
            const url = stdurl(`/api/profile/asset/${asset.name}`);
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
            await std(`/api/profile/asset/${asset.name}`, {
                method: 'DELETE'
            });

            await this.fetchList();
        },
        fetchList: async function() {
            this.upload = false;

            try {
                this.loading.list = true;
                this.err = false;
                this.list = await std(`/api/profile/asset`);
                this.loading.list = false;
                this.$emit('assets', this.list);
            } catch (err) {
                this.err = err;
            }
        }
    }
}
</script>
