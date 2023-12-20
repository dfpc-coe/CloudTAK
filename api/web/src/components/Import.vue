<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <TablerBreadCrumb/>
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
                        <div class='card-header'>
                            <h3 class='card-title'>
                                <div class='d-flex'>
                                    <Status v-if='!loading' :status='imported.status'/>
                                    <div class='d-flex align-items-center'>Import <span class='mx-2' v-text='imported.id'/></div>
                                </div>
                            </h3>
                            <div class='ms-auto btn-list'>
                                <IconRefresh @click='fetch' v-tooltip='`Refresh Import`' class='cursor-pointer'/>
                            </div>
                        </div>
                        <div class='card-body'>
                            <div class='datagrid'>
                                <div class="datagrid-item pb-2">
                                    <div class="datagrid-title">Username</div>
                                    <div class="datagrid-content" v-text='imported.username'></div>
                                </div>
                                <div class="datagrid-item pb-2">
                                    <div class="datagrid-title">Mode</div>
                                    <div class="datagrid-content" v-text='imported.mode'></div>
                                </div>
                                <div class="datagrid-item pb-2">
                                    <div class="datagrid-title">Filename</div>
                                    <div class="datagrid-content" v-text='imported.name'></div>
                                </div>
                            </div>
                            <TablerNone v-if='imported.status === "Empty"' :create='false'/>
                            <TablerLoading v-else-if='loading' desc='Running Import'/>
                            <template v-else-if='imported.status === "Error"'>
                                <pre v-text='imported.error'/>
                            </template>
                        </div>
                        <div class="card-footer d-flex">
                            Created <span v-text='timeDiff(imported.created)' class='mx-2'/>
                            <div class='ms-auto'>Last updated <span v-text='timeDiff(imported.updated)'/></div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-12">
                </div>
            </div>
        </div>
    </div>

    <PageFooter/>
</div>
</template>

<script>
import Status from './util/Status.vue';
import PageFooter from './PageFooter.vue';
import {
    TablerNone,
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh
} from '@tabler/icons-vue';

export default {
    name: 'Import',
    data: function() {
        return {
            loading: true,
            interval: false,
            imported: {
                id: ''
            }
        }
    },
    mounted: async function() {
        await this.fetch();

        this.interval = setInterval(() => {
            this.fetch()
        }, 1000);
    },
    unmounted: function() {
        if (this.interval) clearInterval(this.interval);
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            const url = window.stdurl(`/api/import/${this.$route.params.import}`);
            this.imported = await window.std(url);
            if (this.imported.status === 'Failed' || this.imported.status === 'Success') {
                if (this.interval) clearInterval(this.interval);
                this.loading = false;
            }
        },
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
    },
    components: {
        Status,
        IconRefresh,
        TablerNone,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading
    }
}
</script>
