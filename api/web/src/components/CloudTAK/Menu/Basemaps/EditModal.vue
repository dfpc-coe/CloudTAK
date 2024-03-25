<template>
<TablerModal>
    <div class="card">
        <div class='card-header'>
            <h3 v-if='basemap.id' class='card-title'>BaseMap <span v-text='basemap.id'/></h3>
            <h3 v-else class='card-title'>New BaseMap</h3>

            <div v-if='!loading && !mode.upload && !mode.tilejson' class='ms-auto btn-list'>
                <IconFileUpload
                    @click='mode.upload = true'
                    v-tooltip='"XML Upload"'
                    size='32'
                    class='cursor-pointer'
                />
                <IconFileImport
                    @click='mode.tilejson = true'
                    v-tooltip='"TileJSON Import"'
                    size='32'
                    class='cursor-pointer'
                />
            </div>
        </div>
        <div class="card-body">
            <TablerLoading v-if='loading'/>
            <template v-else-if='mode.upload'>
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
                    <div class="col-12 col-md-9 mt-3">
                        <TablerInput
                            label='BaseMap Name'
                            v-model='basemap.name'
                            :error='errors.name'
                        />
                    </div>
                    <div class="col-12 col-md-3 mt-3">
                        <TablerEnum
                            label='BaseMap Type'
                            v-model='basemap.type'
                            :options='["raster", "raster-dem", "vector"]'
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
                            <div v-if='basemap.id'>
                                <TablerDelete @delete='del' label='Delete Layer'/>
                            </div>

                            <div class='ms-auto'>
                                <a @click='create' class="cursor-pointer btn btn-primary">Save BaseMap</a>
                            </div>
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </div>
</TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import Upload from '../../../util/Upload.vue';
import {
    IconFileImport,
    IconFileUpload
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerDelete,
    TablerLoading,
    TablerEnum,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'BasemapEditModal',
    props: {
        basemap: {
            type: Object
        }
    },
    data: function() {
        return {
            loading: false,
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
                bounds: [-180, -90, 180, 90 ],
                center: [0, 0]
            }
        }
    },
    mounted: async function() {
        if (this.basemap.id) await this.fetch();
    },
    methods: {
        fetchTileJSON: async function() {
            this.loading = true;
            try {
                this.basemap = await std('/api/basemap', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'text/plain'
                    },
                    body: this.tilejson.url
                });
                this.mode.tilejson = false;
                this.loading = false;
            } catch (err) {
                this.loading = false;
                throw err;
            }
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
            return stdurl(`/api/basemap`);
        },
        fetch: async function() {
            this.loading = true;
            this.basemap = await std(`/api/basemap/${this.basemap.id}`);
            this.loading = false;
        },
        create: async function() {
            for (const field of ['name', 'url' ]) {
                if (!this.basemap[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            this.loading = true;
            try {
                if (this.basemap.id) {
                    const basemap = JSON.parse(JSON.stringify(this.basemap));

                    if (!basemap.bounds || !basemap.bounds.length) delete basemap.bounds;
                    if (!basemap.center || !basemap.center.length) delete basemap.center;

                    const create = await std(`/api/basemap/${this.basemap.id}`, {
                        method: 'PATCH',
                        body: basemap
                    });
                    this.$emit('close');
                } else {
                    const create = await std('/api/basemap', {
                        method: 'POST',
                        body: this.basemap
                    });
                    this.$emit('close');
                }
                this.loading = false;
            } catch (err) {
                this.loading = false;
                throw err;
            }
        },
        del: async function() {
            this.loading = true;
            try {
                await std(`/api/basemap/${this.basemap.id}`, {
                    method: 'DELETE'
                });
                this.$emit('close');
            } catch (err) {
                this.loading = false;
                throw err;
            }
        }
    },
    components: {
        Upload,
        IconFileUpload,
        IconFileImport,
        TablerLoading,
        TablerModal,
        TablerDelete,
        TablerInput,
        TablerEnum,
    }
}
</script>
