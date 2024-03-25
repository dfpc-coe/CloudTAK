<template>
<TablerModal>
    <div class="modal-status bg-red"></div>
    <button type="button" class="btn-close" @click='$emit("close")' aria-label="Close"></button>

    <div class='modal-header'>
        <h3 v-if='basemap.id' class='card-title'>Basemap <span v-text='basemap.id'/></h3>
        <h3 v-else class='card-title'>New Basemap</h3>

        <div v-if='!loading && !mode.upload && !mode.tilejson && !basemap.id' class='ms-auto btn-list'>
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
        <div v-else-if='basemap.id' class='ms-auto btn-list'>
            <IconDownload v-tooltip='"Download TAK XML"' size='32' class='cursor-pointer' @click='download'/>
        </div>
    </div>
    <div class="modal-body">
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
                        <button @click='mode.tilejson = false' class="cursor-pointer btn btn-secondary">Cancel</button>
                        <div class='ms-auto'>
                            <a @click='fetchTileJSON' class="cursor-pointer btn btn-primary">Fetch TileJSON</a>
                        </div>
                    </div>
                </div>
            </div>
        </template>
        <template v-else>
            <div class='row row-cards'>
                <div class="col-12 col-md-6 mt-3">
                    <TablerInput
                        label='Basemap Name'
                        v-model='editing.name'
                        :error='errors.name'
                    />
                </div>
                <div class="col-12 col-md-3 mt-3">
                    <TablerEnum
                        label='Basemap Type'
                        v-model='editing.type'
                        :options='["raster", "raster-dem", "vector"]'
                    />
                </div>
                <div class="col-12 col-md-3 mt-3">
                    <TablerEnum
                        label='Basemap Scope'
                        v-model='scope'
                        :disabled='!profile.system_admin || basemap.id'
                        :options='["user", "server"]'
                    />
                </div>
                <div class="col-md-12">
                    <TablerInput
                        label='Basemap Url'
                        v-model='editing.url'
                        :error='errors.url'
                    />
                </div>
                <div class="col-md-4">
                    <TablerInput
                        label='Basemap MinZoom'
                        v-model='editing.minzoom'
                    />
                </div>
                <div class="col-md-4">
                    <TablerInput
                        label='Basemap MaxZoom'
                        v-model='editing.maxzoom'
                    />
                </div>
                <div class="col-md-4">
                    <TablerInput
                        label='Basemap Format'
                        v-model='editing.format'
                    />
                </div>
                <div class="col-md-12 mt-3">
                    <div class='d-flex'>
                        <div v-if='basemap.id'>
                            <TablerDelete @delete='del' label='Delete Layer'/>
                        </div>

                        <div class='ms-auto'>
                            <a @click='create' class="cursor-pointer btn btn-primary">Save Basemap</a>
                        </div>
                    </div>
                </div>
            </div>
        </template>
    </div>
</TablerModal>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import Upload from '../../../util/Upload.vue';
import {
    IconDownload,
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
import { mapState } from 'pinia'
import { useProfileStore } from '/src/stores/profile.js';
const profileStore = useProfileStore();

export default {
    name: 'BasemapEditModal',
    props: {
        basemap: {
            type: Object
        }
    },
    computed: {
        ...mapState(useProfileStore, ['profile']),
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
            scope: this.basemap.username ? 'user' : 'server',
            editing: {
                name: '',
                url: '',
                type: 'raster',
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
        download: async function() {
            window.location.href = stdurl(`api/basemap/${this.basemap.id}?format=xml&download=true&token=${localStorage.token}`);
        },
        fetchTileJSON: async function() {
            this.loading = true;
            try {
                this.editing = await std('/api/basemap', {
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
            this.editing = JSON.parse(body);
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
            this.editing = await std(`/api/basemap/${this.basemap.id}`);
            this.loading = false;
        },
        create: async function() {
            for (const field of ['name', 'url' ]) {
                if (!this.editing[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            this.loading = true;
            try {
                if (this.basemap.id) {
                    const editing = JSON.parse(JSON.stringify(this.editing));

                    if (!editing.bounds || !editing.bounds.length) delete editing.bounds;
                    if (!editing.center || !editing.center.length) delete editing.center;

                    const create = await std(`/api/basemap/${this.basemap.id}`, {
                        method: 'PATCH',
                        body: editing
                    });
                    this.$emit('close');
                } else {
                    const create = await std('/api/basemap', {
                        method: 'POST',
                        body: {
                            scope: this.scope,
                            ...this.editing
                        }
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
        IconDownload,
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
