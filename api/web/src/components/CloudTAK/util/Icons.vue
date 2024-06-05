<template>
    <div class='card'>
        <div class='card-header'>
            <h3 class='card-title'>
                Icons
            </h3>

            <div class='ms-auto btn-list'>
                <IconSearch
                    size='32'
                    class='cursor-pointer'
                    @click='search = !search'
                />
            </div>
        </div>

        <div
            v-if='search'
            class='col-12 px-2'
        >
            <TablerInput
                v-model='paging.filter'
                placeholder='Filter'
            />
        </div>

        <div class='card-body'>
            <TablerLoading
                v-if='loading'
                desc='Loading Icons'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Icons'
                :create='false'
            />
            <template v-else>
                <div class='row g-1'>
                    <div
                        v-for='icon in list.items'
                        :key='icon.name'
                        class='col-sm-2'
                        @click='$router.push(`/menu/iconset/${icon.iconset}/${encodeURIComponent(icon.name)}`)'
                    >
                        <div class='card card-sm hover-dark cursor-pointer'>
                            <div class='col-12'>
                                <div
                                    class='d-flex justify-content-center mt-3'
                                    :class='{
                                        "mt-3": labels,
                                        "my-3": !labels
                                    }'
                                >
                                    <img
                                        :src='iconurl(icon)'
                                        height='32'
                                        width='32'
                                    >
                                </div>
                            </div>
                            <div
                                v-if='labels'
                                class='card-body'
                            >
                                <div class='row'>
                                    <div
                                        class='d-inline-block text-truncate'
                                        v-text='icon.name'
                                    />
                                    <div
                                        class='d-inline-block text-truncate text-muted'
                                        v-text='icon.type2525b || "None"'
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class='col-lg-12 d-flex my-4'>
                        <div class='ms-auto'>
                            <TablerPager
                                v-if='list.total > paging.limit'
                                :page='paging.page'
                                :total='list.total'
                                :limit='paging.limit'
                                @page='paging.page = $event'
                            />
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerPager,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconSearch
} from '@tabler/icons-vue'

export default {
    name: 'IconCombineds',
    components: {
        TablerNone,
        TablerPager,
        TablerInput,
        IconSearch,
        TablerLoading
    },
    props: {
        iconset: {
            type: String
        },
        labels: {
            type: Boolean,
            default: true
        }
    },
    data: function() {
        return {
            err: false,
            loading: true,
            search: false,
            paging: {
                filter: '',
                limit: 100 - 4, // keeps the icon in an even grid
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
        search: function() {
            if (!this.search) this.paging.filter = '';
        },
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList();
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        iconurl: function(icon) {
            const url = stdurl(`/api/iconset/${icon.iconset}/icon/${encodeURIComponent(icon.name)}/raw`);
            url.searchParams.append('token', localStorage.token);
            return String(url);
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/icon');
            url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            if (this.iconset) url.searchParams.append('iconset', this.iconset);
            this.list = await std(url);
            this.loading = false;
        }
    }
}
</script>
