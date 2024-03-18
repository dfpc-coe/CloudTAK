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
                                <BaseMapBadge :type='basemap.type'/>
                                <h3 class="card-title" v-text='basemap.name'></h3>

                                <div class='ms-auto'>
                                    <div class='btn-list'>
                                        <IconShare2 v-tooltip='"Share BaseMap"' size='32' class='cursor-pointer' @click='share = true'/>
                                        <IconDownload v-tooltip='"Download TAK XML"' size='32' class='cursor-pointer' @click='download'/>
                                        <IconSettings v-tooltip='"Edit Basemap"' size='32' class='cursor-pointer' @click='$router.push(`/basemap/${basemap.id}/edit`)'/>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="datagrid pb-3">
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">MinZoom</div>
                                        <div class="datagrid-content" v-text='basemap.minzoom'></div>
                                    </div>
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">MaxZoom</div>
                                        <div class="datagrid-content" v-text='basemap.maxzoom'></div>
                                    </div>
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">Format</div>
                                        <div class="datagrid-content" v-text='basemap.format'></div>
                                    </div>
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">Center</div>
                                        <div class="datagrid-content" v-text='basemap.center ? basemap.center.coordinates.join(",") : "Unknown"'></div>
                                    </div>
                                    <div class="datagrid-item">
                                        <div class="datagrid-title">Bounds</div>
                                        <div class="datagrid-content" v-text='basemap.bounds ? basemap.bounds.bounds : "Unknown"'></div>
                                    </div>
                                </div>

                                <BaseMapLocation :basemap='basemap'/>

                                <pre class='mt-3' v-text='basemap.url'/>
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

    <GroupSelectModal
        v-if='share'
        @close='share = false'
        :item='basemap'
    />
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import GroupSelectModal from './util/GroupSelectModal.vue';
import BaseMapBadge from './BaseMap/Badge.vue';
import {
    TablerBreadCrumb,
    TablerLoading
} from '@tak-ps/vue-tabler';
import BaseMapLocation from './BaseMap/Location.vue';
import timeDiff from '../timediff.js';
import {
    IconShare2,
    IconDownload,
    IconSettings,
} from '@tabler/icons-vue'

export default {
    name: 'BaseMap',
    data: function() {
        return {
            loading: true,
            share: false,
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
            window.location.href = stdurl(`api/basemap/${this.$route.params.basemapid}?format=xml&download=true&token=${localStorage.token}`);
        },
        fetch: async function() {
            this.loading = true;
            this.basemap = await std(`api/basemap/${this.$route.params.basemapid}`);
            this.loading = false;
        }
    },
    components: {
        IconShare2,
        IconSettings,
        IconDownload,
        PageFooter,
        TablerBreadCrumb,
        BaseMapLocation,
        TablerLoading,
        GroupSelectModal,
        BaseMapBadge
    }
}
</script>
