<template>
<div>
    <div class='page-wrapper'>
        <div class="page-header d-print-none">
            <div class="container-xl">
                <div class="row g-2 align-items-center">
                    <div class="col d-flex">
                        <ol class="breadcrumb" aria-label="breadcrumbs">
                            <li class="breadcrumb-item"><a @click='$router.push("/")' class="cursor-pointer">Home</a></li>
                            <li class="breadcrumb-item" aria-current="page"><a  @click='$router.push("/connection")' class="cursor-pointer">Connection</a></li>
                            <li class="breadcrumb-item active" aria-current="page"><a href="#">New</a></li>
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
                            <div class='row row-cards'>
                                <div class="col-md-12 mt-3">
                                    <TablerInput
                                        label='Connection Name'
                                        v-model='connection.name'
                                        :error='errors.name'
                                    />
                                </div>
                                <div class="col-md-12">
                                    <TablerInput
                                        label='Connection Description'
                                        v-model='connection.description'
                                        :error='errors.description'
                                        :rows='6'
                                    />
                                </div>

                                <div v-if='!$route.params.connectionid' class='col-md-12'>
                                    <div class='d-flex'>
                                        <h3>Authentication</h3>

                                        <div class='ms-auto'>
                                            <a @click='upload = true' class="cursor-pointer btn btn-outline-secondary">
                                                Upload .p12
                                            </a>
                                        </div>
                                    </div>

                                    <div class='row mt-3'>
                                        <div class="col-md-6">
                                            <TablerInput
                                                label='Connection Cert'
                                                v-model='connection.auth.cert'
                                                :error='errors.cert'
                                                :rows='6'
                                            />
                                        </div>
                                        <div class="col-md-6">
                                            <TablerInput
                                                label='Connection Key'
                                                v-model='connection.auth.key'
                                                :error='errors.key'
                                                :rows='6'
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class="col-md-12 mt-3">
                                    <div class='d-flex'>
                                        <a v-if='$route.params.connectionid' @click='del' class="cursor-pointer btn btn-outline-danger">
                                            Delete Connection
                                        </a>

                                        <div class='ms-auto'>
                                            <a v-if='$route.params.connectionid' @click='create' class="cursor-pointer btn btn-primary">Edit Connection</a>
                                            <a v-else @click='create' class="cursor-pointer btn btn-primary">Create Connection</a>
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

    <Err v-if='err' :err='err' @close='err = null'/>
    <PageFooter/>
</div>
</template>

<script>
import PageFooter from './PageFooter.vue';
import Upload from './util/UploadP12.vue';
import {
    Err,
    Input
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionNew',
    data: function() {
        return {
            err: false,
            upload: false,
            errors: {
                name: '',
                description: '',
                cert: '',
                key: ''
            },
            connection: {
                name: '',
                description: '',
                auth: {
                    cert: '',
                    key: ''
                }
            }
        }
    },
    mounted: function() {
        if (this.$route.params.connectionid) this.fetch();
    },
    methods: {
        fetch: async function() {
            try {
                this.connection = await window.std(`/api/connection/${this.$route.params.connectionid}`);
            } catch (err) {
                this.err = err;
            }
        },
        p12upload: function(certs) {
            this.upload = false;
            this.connection.auth.cert = certs.pemCertificate
                .split('-----BEGIN CERTIFICATE-----')
                .join('-----BEGIN CERTIFICATE-----\n')
                .split('-----END CERTIFICATE-----')
                .join('\n-----END CERTIFICATE-----');
            this.connection.auth.key = certs.pemKey
                .split('-----BEGIN RSA PRIVATE KEY-----')
                .join('-----BEGIN RSA PRIVATE KEY-----\n')
                .split('-----END RSA PRIVATE KEY-----')
                .join('\n-----END RSA PRIVATE KEY-----');
        },
        create: async function() {
            for (const field of ['name', 'description' ]) {
                if (!this.connection[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
            }

            for (const field of Object.keys(this.connection.auth)) {
                if (!this.connection.auth[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            try {
                const create = await window.std('/api/connection', {
                    method: 'POST',
                    body: {
                        name: this.connection.name,
                        description: this.connection.description,
                        enabled: true,
                        auth: this.connection.auth
                    }
                });

                this.$router.push(`/connection/${create.id}`);
            } catch (err) {
                this.err = err;
            }
        },
        del: async function() {
            try {
                await window.std(`/api/connection/${this.$route.params.connectionid}`, {
                    method: 'DELETE'
                });

                this.$router.push('/connection');
            } catch (err) {
                this.err = err;
            }
        }
    },
    components: {
        Err,
        Upload,
        TablerInput: Input,
        PageFooter,
    }
}
</script>
