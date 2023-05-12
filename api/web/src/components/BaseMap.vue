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
                                        <DownloadIcon class='cursor-pointer' @click='download'/>
                                        <SettingsIcon class='cursor-pointer' @click='$router.push(`/basemap/${basemap.id}/edit`)'/>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="datagrid pb-3">
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">MinZoom</div>
                                        <div class="datagrid-content" v-text='basemap.minzoom || "Unknown"'></div>
                                    </div>
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">MaxZoom</div>
                                        <div class="datagrid-content" v-text='basemap.maxzoom || "Unknown"'></div>
                                    </div>
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">Format</div>
                                        <div class="datagrid-content" v-text='basemap.format || "Unknown"'></div>
                                    </div>
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">Center</div>
                                        <div class="datagrid-content" v-text='basemap.center || "Unknown"'></div>
                                    </div>
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">Bounds</div>
                                        <div class="datagrid-content" v-text='basemap.bounds || "Unknown"'></div>
                                    </div>
                                </div>

                                <BaseMapLocation :basemap='basemap'/>
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
import BaseMapLocation from './BaseMap/Location.vue';
import timeDiff from '../timediff.js';
import {
    DownloadIcon,
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
        download: async function() {
            window.location.href = window.stdurl(`api/basemap/${this.$route.params.basemapid}?format=xml&download=true&token=${localStorage.token}`);
        },
        fetch: async function() {
            this.loading = true;
            this.basemap = await window.std(`api/basemap/${this.$route.params.basemapid}`);
            this.loading = false;
        }
    },
    components: {
        SettingsIcon,
        DownloadIcon,
        PageFooter,
        TablerBreadCrumb,
        BaseMapLocation,
        TablerLoading
    }
}
</script>
