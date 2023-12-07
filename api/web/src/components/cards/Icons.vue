<template>
<div class="card">
    <div class="card-header">
        <h3 class='card-title'>Icon Search</h3>

        <div class='ms-auto'>
            <div class="input-icon">
                <input v-model='paging.filter' type="text" class="form-control" placeholder="Search…">
                <span class="input-icon-addon">
                    <SearchIcon/>
                </span>
            </div>
        </div>
    </div>
    <div class="card-body">
        <TablerLoading v-if='loading' desc='Loading Icons'/>
        <TablerNone
            v-else-if='!list.icons.length'
            label='Icons'
            :create='false'
        />
        <template v-else>
            <div class='row g-1'>
                <div :key='icon.id' v-for='icon in list.icons' class="col-sm-2">
                    <div class="card card-sm">
                        <div class='col-12'>
                            <div class='d-flex justify-content-center mt-3'>
                                <img :src='iconurl(icon)' height='32' width='32'>
                            </div>
                        </div>
                        <div class="card-body">
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
import {
    TablerNone,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    SearchIcon
} from 'vue-tabler-icons'

export default {
    name: 'CombinedIcons',
    props: {
        iconset: {
            type: String
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
                icons: []
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
            const url = window.stdurl(`/api/iconset/${icon.iconset}/icon/${encodeURIComponent(icon.name)}/raw`);
            url.searchParams.append('token', localStorage.token);
            return String(url);
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/icon');
            url.searchParams.append('filter', this.paging.filter);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            if (this.iconset) url.searchParams.append('iconset', this.iconset);
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        TablerPager,
        SearchIcon,
        TablerLoading
    }
}
</script>
