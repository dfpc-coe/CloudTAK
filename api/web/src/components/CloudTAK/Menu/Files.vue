<template>
    <MenuTemplate name='User Files'>
        <template #buttons>
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
            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!list.assets.length'
                label='Imports'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='asset in list.assets'
                    :key='asset.name'
                >
                    <div class='col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                        <div class='col-auto'>
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
                        <div class='col-auto'>
                            <div class='col-12'>
                                <span
                                    class='mx-2'
                                    v-text='asset.name'
                                />
                            </div>
                            <div class='col-12 subheader'>
                                <span class='mx-2'>
                                    <TablerBytes :bytes='asset.size' /> - <TablerEpoch :date='asset.updated' />
                                </span>
                            </div>
                        </div>
                        <div class='col-auto ms-auto'>
                            <div class='d-flex btn-list'>
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
                        </div>
                    </div>
                </div>
            </template>

            <div class='px-2 py-2'>
                <TablerPager
                    v-if='list.total > paging.limit'
                    :page='paging.page'
                    :total='list.total'
                    :limit='paging.limit'
                    @page='paging.page = $event'
                />
            </div>
        </template>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerDelete,
    TablerNone,
    TablerPager,
    TablerLoading,
    TablerBytes,
    TablerEpoch
} from '@tak-ps/vue-tabler';
import {
    IconMap,
    IconMapOff,
    IconTransform,
    IconDownload,
    IconRefresh,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import timeDiff from '../../../timediff.js';

export default {
    name: 'CloudTAKImports',
    components: {
        TablerNone,
        TablerPager,
        TablerLoading,
        TablerBytes,
        TablerEpoch,
        TablerDelete,
        IconMap,
        IconMapOff,
        IconTransform,
        IconDownload,
        IconRefresh,
        MenuTemplate,
    },
    data: function() {
        return {
            err: false,
            loading: true,
            paging: {
                limit: 20,
                page: 0
            },
            list: {
                assets: []
            }
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList()
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update)
        },
        downloadAsset: async function(asset) {
            const url = stdurl(`/api/profile/asset/${asset.name}`);
            url.searchParams.append('token', localStorage.token);
            window.open(url, "_blank")
        },
        fetchList: async function() {
            this.upload = false;

            try {
                this.loading = true;
                this.err = false;
                this.list = await std(`/api/profile/asset`);
                this.loading = false;
            } catch (err) {
                this.err = err;
            }
        },
        deleteAsset: async function(asset) {
            this.loading = true;
            await std(`/api/profile/asset/${asset.name}`, {
                method: 'DELETE'
            });

            await this.fetchList();
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
    }
}
</script>
