<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item" aria-current="page"><a @click='$router.push("/")' class='cursor-pointer'>Home</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#">Icons</a></li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div class="col-lg-12">
                    <div class="card">
                        <div class="card-body">
                            <label class="form-label">Icon Search</label>
                            <div class="input-icon mb-3">
                                <input v-model='query.search' type="text" class="form-control" placeholder="Search…">
                                <span class="input-icon-addon">
                                    <SearchIcon/>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <template v-if='loading'>
                    <TablerLoading/>
                </template>
                <template v-else>
                    <None
                        v-if='!list.icons.length'
                        label='Icons'
                        @create='$router.push("/layer/new")'
                    />
                    <div :key='icon.id' v-for='icon in list.icons' class="col-sm-6 col-lg-4">
                        <div class="card card-sm">
                            <a href="#" class="d-block">
                                <img src="/icon/${icon.file}" class="card-img-top">
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
    </div>

    <PageFooter/>
</div>
</template>

<script>
import None from './cards/None.vue';
import PageFooter from './PageFooter.vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    SearchIcon
} from 'vue-tabler-icons'

export default {
    name: 'Icons',
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
        None,
        SearchIcon,
        PageFooter,
        TablerLoading
    }
}
</script>
