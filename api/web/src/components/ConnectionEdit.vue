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
                        <div class='card-header'>
                            <h3 v-if='$route.params.connectionid' class='card-title'>Connection <span v-text='connection.id'/></h3>
                            <h3 v-else class='card-title'>New Connection</h3>

                            <div class='ms-auto'>
                                <div class='d-flex'>
                                    <div class='btn-list'>
                                        <div class='d-flex'>
                                            <span class='px-2'>Enabled</span>
                                            <label class="form-check form-switch">
                                                <input v-model='connection.enabled' class="form-check-input" type="checkbox">
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
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
                                            <a @click='create' class="cursor-pointer btn btn-primary">Save Connection</a>
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
import { TablerInput } from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionNew',
    data: function() {
        return {
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
                enabled: true,
                auth: {
                    cert: '',
                    key: ''
                }
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.connectionid) await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.connection = await window.std(`/api/connection/${this.$route.params.connectionid}`);
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

            if (!this.$route.params.connectionid) {
                for (const field of Object.keys(this.connection.auth)) {
                    if (!this.connection.auth[field]) this.errors[field] = 'Cannot be empty';
                    else this.errors[field] = '';
                }
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            if (this.$route.params.connectionid) {
                const create = await window.std(`/api/connection/${this.$route.params.connectionid}`, {
                    method: 'PATCH',
                    body: this.connection
                });
                this.$router.push(`/connection/${create.id}`);
            } else {
                const create = await window.std('/api/connection', {
                    method: 'POST',
                    body: this.connection
                });
                this.$router.push(`/connection/${create.id}`);
            }
        },
        del: async function() {
            await window.std(`/api/connection/${this.$route.params.connectionid}`, {
                method: 'DELETE'
            });
            this.$router.push('/connection');
        }
    },
    components: {
        Upload,
        TablerInput,
        PageFooter,
    }
}
</script>
