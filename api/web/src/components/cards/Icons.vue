<template>
<div class="card">
    <div class="card-header">
        <h3 class='card-title'>Icon Search</h3>

        <div class="input-icon mb-3">
            <input v-model='query.search' type="text" class="form-control" placeholder="Search…">
            <span class="input-icon-addon">
                <SearchIcon/>
            </span>
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
                @create='$router.push("/layer/new")'
            />
            <div :key='icon.id' v-for='icon in list.icons' class="col-sm-2">
                <div class="card card-sm">
                    <a href="#" class="d-block">
                        <img :src="`/icons/${icon.file}`" class="card-img-top">
                    </a>
                    <div class="card-body">
                        <div class="d-flex align-items-center">
                            <div>
                                <div v-text='icon.name'></div>
                                <div class="text-muted" v-text='icon.id'></div>
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
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/icon');
            url.searchParams.append('filter', this.query.search);
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
