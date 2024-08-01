<template>
    <MenuTemplate name='User Files'>
        <template #buttons>
            <IconPlus
                v-if='!loading && !upload'
                v-tooltip='"New Import"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='upload = true'
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
            <div
                v-if='upload'
                class='py-2 px-4'
            >
                <Upload
                    :url='uploadURL()'
                    :headers='uploadHeaders()'
                    method='PUT'
                    @cancel='upload = false'
                    @done='uploadComplete($event)'
                />
            </div>

            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                label='Imports'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='imported in list.items'
                    :key='imported.id'
                    @click='$router.push(`/menu/imports/${imported.id}`)'
                >
                    <div class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
                        <div class='col-auto'>
                            <Status
                                :dark='true'
                                :status='imported.status'
                            />
                        </div>
                        <div
                            class='mx-2 col-auto row'
                            style='width: 300px;'
                        >
                            <div
                                class='text-truncate'
                                v-text='imported.name'
                            />
                            <div
                                class='subheader'
                                v-text='timeDiff(imported.created)'
                            />
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
    TablerNone,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import Status from '../../util/Status.vue';
import timeDiff from '../../../timediff.js';
import Upload from '../../util/Upload.vue';

export default {
    name: 'CloudTAKImports',
    components: {
        Status,
        Upload,
        TablerNone,
        TablerPager,
        TablerLoading,
        IconPlus,
        IconRefresh,
        MenuTemplate,
    },
    data: function() {
        return {
            upload: false,
            err: false,
            loading: true,
            paging: {
                limit: 20,
                page: 0
            },
            list: []
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
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadComplete: function(event) {
            this.upload = false;
            const imp = JSON.parse(event);
            this.$router.push(`/menu/imports/${imp.imports[0].uid}`)
        },
        uploadURL: function() {
            return stdurl(`/api/import`);
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/import');
            url.searchParams.append('order', 'desc');
            url.searchParams.append('page', this.paging.page);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('sort', 'created');
            this.list = await std(url);
            this.loading = false;
        },
    }
}
</script>
