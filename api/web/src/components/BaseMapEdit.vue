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
                        </div>
                        <div class="card-body">
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <Upload
        v-if='upload'
        @certs='p12upload($event)'
        @close='upload = false'
        @err='err = $event'
    />

    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import Upload from './util/UploadP12.vue';
import {
    TablerBreadCrumb,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'BaseMapNew',
    data: function() {
        return {
            upload: false,
            errors: {
                name: '',
                url: '',
            },
            basemap: {
                name: '',
                url: ''
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.basemapid) await this.fetch();
    },
    methods: {
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
        TablerBreadCrumb,
        TablerInput,
        PageFooter,
    }
}
</script>
