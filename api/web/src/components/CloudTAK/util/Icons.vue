<template>
<div class="card">
    <div class="card-header">
        <h3 class='card-title'>Icon Search</h3>

        <div class='ms-auto btn-list'>
            <IconSearch size='32' class='cursor-pointer'/>
        </div>
    </div>
    <div class="card-header">
        <TablerInput v-model='paging.filter'/>
    </div>
    <div class="card-body">
        <TablerLoading v-if='loading' desc='Loading Icons'/>
        <TablerNone
            v-else-if='!list.items.length'
            label='Icons'
            :create='false'
        />
        <template v-else>
            <div class='row g-1'>
                <div @click='$router.push(`/iconset/${icon.iconset}/icon/${encodeURIComponent(icon.name)}`)' :key='icon.name' v-for='icon in list.items' class="col-sm-2">
                    <div class="card card-sm hover-dark cursor-pointer">
                        <div class='col-12'>
                            <div class='d-flex justify-content-center mt-3'>
                                <img :src='iconurl(icon)' height='32' width='32'>
                            </div>
                        </div>
                        <div v-if='labels' class="card-body">
                            <div class='row'>
                                <div class='d-inline-block text-truncate' v-text='icon.name'></div>
                                <div class="d-inline-block text-truncate text-muted" v-text='icon.type2525b || "None"'></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-12 d-flex my-4">
                    <div class='ms-auto'>
                        <TablerPager v-if='list.total > paging.limit' @page='paging.page = $event' :page='paging.page'  :total='list.total' :limit='paging.limit'/>
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
            paging: {
                filter: '',
                limit: 100,
                page: 0
            },
            list: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
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
    },
    components: {
        TablerNone,
        TablerPager,
        TablerInput,
        IconSearch,
        TablerLoading
    }
}
</script>
