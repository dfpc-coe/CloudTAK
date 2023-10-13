<template>
<div class="card">
    <div class="card-header">
        <h3 class='card-title'>Icon Search</h3>

        <div class='ms-auto'>
            <div class="input-icon">
                <input v-model='query.search' type="text" class="form-control" placeholder="Search…">
                <span class="input-icon-addon">
                    <SearchIcon/>
                </span>
            </div>
        </div>
    </div>
    <div class="card-body">
        <template v-if='loading'>
            <TablerLoading/>
        </template>
        <template v-else>
            <TablerNone
                v-if='!list.icons.length'
                label='Icons'
                :create='false'
            />
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
            </div>
        </template>
    </div>
</div>
</template>

<script>
import {
    TablerNone,
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
            query: {
                search: ''
            },
            list: {
                icons: []
            }
        }
    },
    watch: {
        'query.search': function() {
            this.fetchList();
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        iconurl: function(icon) {
            const url = window.stdurl(`/api/iconset/${icon.iconset}/icon/${icon.name}/raw`);
            url.searchParams.append('token', localStorage.token);
            return String(url);
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/icon');
            url.searchParams.append('filter', this.query.search);
            url.searchParams.append('iconset', this.iconset);
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        SearchIcon,
        TablerLoading
    }
}
</script>
