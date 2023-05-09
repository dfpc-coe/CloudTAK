<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <TablerBreadCrumb/>

                        <div class='ms-auto'>
                            <div class='btn-list'>
                                <a @click='query.shown = !query.shown' class="cursor-pointer btn btn-secondary">
                                    <SearchIcon/>
                                </a>

                                <a @click='$router.push("/data/new")' class="cursor-pointer btn btn-primary">
                                    New Data
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class='page-body'>
        <div class='container-xl'>
            <div class='row row-deck row-cards'>
                <div v-if='query.shown' class="col-lg-12">
                    <div class="card">
                        <div class="card-body">
                            <label class="form-label">Data Search</label>
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
                        v-if='!list.data.length'
                        label='Data'
                        @create='$router.push("/data/new")'
                    />
                    <div :key='data.id' v-for='data in list.data' class="col-lg-12">
                        <div class="card">
                            <div class="card-header">
                                <a @click='$router.push(`/data/${data.id}`)' class="card-title cursor-pointer" v-text='data.name'></a>

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <SettingsIcon class='cursor-pointer' @click='$router.push(`/data/${data.id}/edit`)'/>
                                    </div>
                                </div>
                            </div>
                            <TablerMarkdown class='card-body' :markdown='data.description'/>
                            <div class="card-footer">
                                Last updated <span v-text='timeDiff(data.updated)'/>
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
    TablerBreadCrumb,
    TablerMarkdown,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    SettingsIcon,
    SearchIcon
} from 'vue-tabler-icons'

export default {
    name: 'Datas',
    data: function() {
        return {
            err: false,
            loading: true,
            query: {
                shown: false,
                search: ''
            },
            list: {
                data: []
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
        timeDiff: function(updated) {
            const msPerMinute = 60 * 1000;
            const msPerHour = msPerMinute * 60;
            const msPerDay = msPerHour * 24;
            const msPerMonth = msPerDay * 30;
            const msPerYear = msPerDay * 365;
            const elapsed = +(new Date()) - updated;

            if (elapsed < msPerMinute) return Math.round(elapsed/1000) + ' seconds ago';
            if (elapsed < msPerHour) return Math.round(elapsed/msPerMinute) + ' minutes ago';
            if (elapsed < msPerDay ) return Math.round(elapsed/msPerHour ) + ' hours ago';
            if (elapsed < msPerMonth) return '~' + Math.round(elapsed/msPerDay) + ' days ago';
            if (elapsed < msPerYear) return '~' + Math.round(elapsed/msPerMonth) + ' months ago';
            return '~' + Math.round(elapsed/msPerYear ) + ' years ago';
        },
        fetchList: async function() {
            this.loading = true;
            const url = window.stdurl('/api/data');
            if (this.query.shown && this.query.search) url.searchParams.append('filter', this.query.search);
            this.list = await window.std(url);
            this.loading = false;
        }
    },
    components: {
        None,
        SettingsIcon,
        SearchIcon,
        PageFooter,
        TablerBreadCrumb,
        TablerMarkdown,
        TablerLoading,
    }
}
</script>
