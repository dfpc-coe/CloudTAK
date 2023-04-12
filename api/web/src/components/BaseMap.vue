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
                <template v-if='loading'>
                    <TablerLoading/>
                </template>
                <template v-else>
                    <div class="col-lg-12">
                        <div class="card">
                            <div class="card-header">
                                <h3 class="card-title" v-text='basemap.name'></h3>

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <SettingsIcon class='cursor-pointer' @click='$router.push(`/basemap/${basemap.id}/edit`)'/>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                            </div>
                            <div class="card-footer">
                                <span v-text='`Last Updated: ${timeDiff(basemap.updated)}`'/>
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
import PageFooter from './PageFooter.vue';
import {
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import timeDiff from '../timediff.js';
import {
    SettingsIcon,
} from 'vue-tabler-icons'

export default {
    name: 'BaseMap',
    data: function() {
        return {
            loading: true,
            basemap: {}
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update);
        },
        fetch: async function() {
            this.loading = true;
            this.basemap = await window.std(`api/basemap/${this.$route.params.basemapid}`);
            this.loading = false;
        }
    },
    components: {
        SettingsIcon,
        PageFooter,
        TablerBreadCrumb,
        TablerLoading
    }
}
</script>
