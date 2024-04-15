<template>
    <div>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex'>
                            <TablerBreadCrumb />
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class='page-body'>
            <div class='container-xl'>
                <div class='row row-deck row-cards'>
                    <div class='col-lg-12'>
                        <template v-if='loading'>
                            <TablerLoading />
                        </template>
                        <template v-else>
                            <div class='card'>
                                <div class='card-header'>
                                    <h3
                                        v-if='$route.params.connectionid'
                                        class='card-title'
                                    >
                                        Connection <span v-text='connection.id' />
                                    </h3>
                                    <h3
                                        v-else
                                        class='card-title'
                                    >
                                        New Connection
                                    </h3>

                                    <div class='ms-auto'>
                                        <div class='d-flex'>
                                            <div class='btn-list'>
                                                <div class='d-flex'>
                                                    <span class='px-2'>Enabled</span>
                                                    <label class='form-check form-switch'>
                                                        <input
                                                            v-model='connection.enabled'
                                                            class='form-check-input'
                                                            type='checkbox'
                                                        >
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class='card-body'>
                                    <div class='row row-cards'>
                                        <div class='col-md-12 mt-3'>
                                            <TablerInput
                                                v-model='connection.name'
                                                label='Connection Name'
                                                :error='errors.name'
                                            />
                                        </div>
                                        <div class='col-md-12'>
                                            <TablerInput
                                                v-model='connection.description'
                                                label='Connection Description'
                                                :error='errors.description'
                                                :rows='6'
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div class='card-header d-flex'>
                                    <h3 class='card-title'>
                                        Connection Authentication
                                    </h3>
                                    <div
                                        v-if='!$route.params.connectionid || regen'
                                        class='ms-auto btn-list'
                                    >
                                        <IconLogin
                                            v-tooltip='"User Login"'
                                            size='32'
                                            class='cursor-pointer'
                                            @click='modal.login = true'
                                        />
                                        <IconPlus
                                            v-tooltip='"P12 Upload"'
                                            size='32'
                                            class='cursor-pointer'
                                            @click='modal.upload = true'
                                        />
                                    </div>
                                </div>
                                <div class='card-body'>
                                    <div class='row mt-3'>
                                        <template v-if='!$route.params.connectionid || regen'>
                                            <div class='col-md-6'>
                                                <TablerInput
                                                    v-model='connection.auth.cert'
                                                    label='Connection Cert'
                                                    :error='errors.cert'
                                                    :rows='6'
                                                />
                                            </div>
                                            <div class='col-md-6'>
                                                <TablerInput
                                                    v-model='connection.auth.key'
                                                    label='Connection Key'
                                                    :error='errors.key'
                                                    :rows='6'
                                                />
                                            </div>
                                        </template>
                                        <template v-else>
                                            <div class='border px-3 py-3'>
                                                <div class='d-flex justify-content-center'>
                                                    <IconLock size='50' />
                                                </div>
                                                <div class='d-flex justify-content-center my-3'>
                                                    Once Certificates are generated they cannot be viewed
                                                </div>
                                                <div class='d-flex justify-content-center'>
                                                    <button
                                                        class='btn btn-secondary'
                                                        @click='regen=true'
                                                    >
                                                        Regenerate Certificate
                                                    </button>
                                                </div>
                                            </div>
                                        </template>

                                        <div class='col-md-12 mt-3'>
                                            <div class='d-flex'>
                                                <TablerDelete
                                                    v-if='$route.params.connectionid'
                                                    label='Delete Connection'
                                                    @delete='del'
                                                />

                                                <div class='ms-auto'>
                                                    <a
                                                        class='cursor-pointer btn btn-primary'
                                                        @click='create'
                                                    >Save Connection</a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>

        <Upload
            v-if='modal.upload'
            @certs='p12upload($event)'
            @close='modal.upload = false'
            @err='err = $event'
        />

        <LoginCertModal
            v-if='modal.login'
            @certs='marti($event)'
            @close='modal.login = false'
            @err='err = $event'
        />

        <PageFooter />
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import Upload from './util/UploadP12.vue';
import LoginCertModal from './util/LoginCertModal.vue';
import {
    IconPlus,
    IconLock,
    IconLogin,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerBreadCrumb,
    TablerDelete,
    TablerInput
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionNew',
    components: {
        Upload,
        IconPlus,
        IconLock,
        IconLogin,
        TablerDelete,
        TablerBreadCrumb,
        LoginCertModal,
        TablerInput,
        TablerLoading,
        PageFooter,
    },
    data: function() {
        return {
            loading: true,
            regen: false,
            modal: {
                login: false,
                upload: false,
            },
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
                auth: { cert: '', key: '' }
            }
        }
    },
    mounted: async function() {
        if (this.$route.params.connectionid) await this.fetch();
        else this.loading = false;
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.connection = await std(`/api/connection/${this.$route.params.connectionid}`);
            this.connection.auth = { cert: '', key: '' }
            this.loading = false;
        },
        marti: function(certs) {
            console.error(certs);
            this.connection.auth.cert = certs.cert;
            this.connection.auth.key = certs.key;
        },
        p12upload: function(certs) {
            this.modal.upload = false;
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

            if (!this.$route.params.connectionid || this.regen) {
                for (const field of Object.keys(this.connection.auth)) {
                    if (!this.connection.auth[field]) this.errors[field] = 'Cannot be empty';
                    else this.errors[field] = '';
                }
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            if (this.$route.params.connectionid) {
                const connection = JSON.parse(JSON.stringify(this.connection));
                if (!this.regen) delete connection.auth;

                const create = await std(`/api/connection/${this.$route.params.connectionid}`, {
                    method: 'PATCH',
                    body: connection
                });
                this.$router.push(`/connection/${create.id}`);
            } else {
                const create = await std('/api/connection', {
                    method: 'POST',
                    body: this.connection
                });
                this.$router.push(`/connection/${create.id}`);
            }
        },
        del: async function() {
            await std(`/api/connection/${this.$route.params.connectionid}`, {
                method: 'DELETE'
            });
            this.$router.push('/connection');
        }
    }
}
</script>
