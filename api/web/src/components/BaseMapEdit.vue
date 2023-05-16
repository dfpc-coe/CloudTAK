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
                            <h3 v-if='$route.params.basemapid' class='card-title'>BaseMap <span v-text='basemap.id'/></h3>
                            <h3 v-else class='card-title'>New BaseMap</h3>

                            <div v-if='!mode.upload && !mode.tilejson' class='ms-auto btn-list'>
                                <FileUploadIcon @click='mode.upload = true' v-tooltip='"XML Upload"' class='cursor-pointer'/>
                                <FileImportIcon @click='mode.tilejson = true' v-tooltip='"TileJSON Import"' class='cursor-pointer'/>
                            </div>
                        </div>
                        <div class="card-body">
                            <template v-if='mode.upload'>
                                <Upload
                                    method='PUT'
                                    :url='uploadURL()'
                                    :headers='uploadHeaders()'
                                    @done='processUpload($event)'
                                    @cancel='mode.upload = false'
                                    @err='err = $event'
                                />
                            </template>
                            <template v-else-if='mode.tilejson'>
                                <div class='row row-cards'>
                                    <div class="col-md-12 mt-3">
                                        <TablerInput
                                            label='TileJSON URL'
                                            v-model='tilejson.url'
                                        />
                                    </div>
                                    <div class="col-md-12 mt-3">
                                        <div class='d-flex'>
                                            <div class='ms-auto'>
                                                <a @click='fetchTileJSON' class="cursor-pointer btn btn-primary">Fetch TileJSON</a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>
                            <template v-else>
                                <div class='row row-cards'>
                                    <div class="col-md-12 mt-3">
                                        <TablerInput
                                            label='BaseMap Name'
                                            v-model='basemap.name'
                                            :error='errors.name'
                                        />
                                    </div>
                                    <div class="col-md-12">
                                        <TablerInput
                                            label='BaseMap Url'
                                            v-model='basemap.url'
                                            :error='errors.url'
                                        />
                                    </div>
                                    <div class="col-md-4">
                                        <TablerInput
                                            label='BaseMap MinZoom'
                                            v-model='basemap.minzoom'
                                        />
                                    </div>
                                    <div class="col-md-4">
                                        <TablerInput
                                            label='BaseMap MaxZoom'
                                            v-model='basemap.maxzoom'
                                        />
                                    </div>
                                    <div class="col-md-4">
                                        <TablerInput
                                            label='BaseMap Format'
                                            v-model='basemap.format'
                                        />
                                    </div>
                                    <div class="col-md-12 mt-3">
                                        <div class='d-flex'>
                                            <a v-if='$route.params.basemapid' @click='del' class="cursor-pointer btn btn-outline-danger">
                                                Delete BaseMap
                                            </a>

                                            <div class='ms-auto'>
                                                <a @click='create' class="cursor-pointer btn btn-primary">Save BaseMap</a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import Upload from './util/Upload.vue';
import {
    FileImportIcon,
    FileUploadIcon
} from 'vue-tabler-icons';
import {
    TablerBreadCrumb,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'BaseMapNew',
    data: function() {
        return {
            mode: {
                upload: false,
                tilejson: false,
            },
            tilejson: {
                url: ''
            },
            errors: {
                name: '',
                url: '',
            },
            bounds: '',
            center: '',
            basemap: {
                name: '',
                url: '',
                minzoom: 0,
                maxzoom: 16,
                format: 'png',
                bounds: [],
                center: []
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.basemapid) await this.fetch();
    },
    methods: {
        fetchTileJSON: async function() {
            console.error('TILEJSON');
        },
        processUpload: function(body) {
            this.mode.upload = false;
            this.basemap = JSON.parse(body);
        },
        uploadHeaders: function() {
            return {
                Authorization: `Bearer ${localStorage.token}`
            };
        },
        uploadURL: function() {
            return window.stdurl(`/api/basemap`);
        },
        fetch: async function() {
            this.basemap = await window.std(`/api/basemap/${this.$route.params.basemapid}`);
        },
        create: async function() {
            for (const field of ['name', 'url' ]) {
                if (!this.basemap[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            if (this.$route.params.basemapid) {
                const create = await window.std(`/api/basemap/${this.$route.params.basemapid}`, {
                    method: 'PATCH',
                    body: this.basemap
                });
                this.$router.push(`/basemap/${create.id}`);
            } else {
                const create = await window.std('/api/basemap', {
                    method: 'POST',
                    body: this.basemap
                });
                this.$router.push(`/basemap/${create.id}`);
            }
        },
        del: async function() {
            await window.std(`/api/basemap/${this.$route.params.basemapid}`, {
                method: 'DELETE'
            });
            this.$router.push('/basemap');
        }
    },
    components: {
        Upload,
        FileUploadIcon,
        FileImportIcon,
        TablerBreadCrumb,
        TablerInput,
        PageFooter,
    }
}
</script>
