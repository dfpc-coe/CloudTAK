<template>
    <div style='overflow: auto;'>
        <div class='page-wrapper'>
            <div class='page-header d-print-none'>
                <div class='container-xl'>
                    <div class='row g-2 align-items-center'>
                        <div class='col d-flex text-white'>
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
                                                description='
                                                    The human readable name of the Connection
                                                '
                                            />
                                        </div>
                                        <div class='col-md-12'>
                                            <TablerInput
                                                v-model='connection.description'
                                                label='Connection Description'
                                                description='
                                                    Human readable details about what the connection contains or is used for
                                                '
                                                :error='errors.description'
                                                :rows='6'
                                            />
                                        </div>
                                        <div class='col-md-12'>
                                            <AgencySelect
                                                v-model='connection.agency'
                                                label='Agency Owner'
                                            />
                                        </div>
                                    </div>
                                </div>

                                <template v-if='isNextReady || $route.params.connectionid'>
                                    <div class='card-header'>
                                        <h3 class='card-title'>
                                            Connection Authentication
                                        </h3>
                                    </div>
                                    <div class='card-body'>
                                        <div class='row'>
                                            <template v-if='isReady'>
                                                <div class='col-12 d-flex align-items-center'>
                                                    <IconCheck
                                                        :size='40'
                                                        class='text-green'
                                                    />
                                                    <span class='mx-3'>Certificate Uploaded</span>

                                                    <div class='ms-auto'>
                                                        <IconTrash
                                                            v-tooltip='"Remove Certificate"'
                                                            :size='32'
                                                            :stroke='1'
                                                            class='cursor-pointer'
                                                            @click='marti({ key: "", cert: ""})'
                                                        />
                                                    </div>
                                                </div>
                                            </template>
                                            <template v-else-if='!$route.params.connectionid || regen'>
                                                <div class='col-12 pb-2'>
                                                    <div
                                                        class='btn-group w-100'
                                                        role='group'
                                                    >
                                                        <input
                                                            id='creation'
                                                            type='radio'
                                                            class='btn-check'
                                                            name='cert-type'
                                                            autocomplete='off'
                                                            :checked='type === "creation"'
                                                            @click='type = "creation"'
                                                        >
                                                        <label
                                                            for='creation'
                                                            type='button'
                                                            class='btn'
                                                        >Machine User Creation</label>

                                                        <input
                                                            id='login'
                                                            type='radio'
                                                            class='btn-check'
                                                            name='cert-type'
                                                            autocomplete='off'
                                                            :checked='type === "login"'
                                                            @click='type = "login"'
                                                        >
                                                        <label
                                                            for='login'
                                                            type='button'
                                                            class='btn'
                                                        >User Login</label>

                                                        <input
                                                            id='p12'
                                                            type='radio'
                                                            class='btn-check'
                                                            name='cert-type'
                                                            autocomplete='off'
                                                            :checked='type === "p12"'
                                                            @click='type = "p12"'
                                                        >
                                                        <label
                                                            for='p12'
                                                            type='button'
                                                            class='btn'
                                                        >P12 Certificate Upload</label>

                                                        <input
                                                            id='raw'
                                                            type='radio'
                                                            class='btn-check'
                                                            name='cert-type'
                                                            autocomplete='off'
                                                            :checked='type === "raw"'
                                                            @click='type = "raw"'
                                                        >
                                                        <label
                                                            for='raw'
                                                            type='button'
                                                            class='btn'
                                                        >Raw Certificate</label>
                                                    </div>
                                                </div>
                                                <template v-if='type === "raw"'>
                                                    <CertificateRaw
                                                        @certs='marti($event)'
                                                        @err='err = $event'
                                                    />
                                                </template>
                                                <template v-else-if='type === "p12"'>
                                                    <CertificateP12
                                                        class='mx-2'
                                                        @certs='p12upload($event)'
                                                        @err='err = $event'
                                                    />
                                                </template>
                                                <template v-else-if='type === "login"'>
                                                    <CertificateLogin
                                                        @certs='marti($event)'
                                                        @err='err = $event'
                                                    />
                                                </template>
                                                <template v-else-if='type === "creation"'>
                                                    <CertificateMachineUser
                                                        :connection='connection'
                                                        @certs='creation($event)'
                                                        @integration='integration($event)'
                                                        @err='err = $event'
                                                    />
                                                </template>
                                            </template>
                                            <template v-else>
                                                <div class='border px-3 py-3'>
                                                    <div class='d-flex justify-content-center'>
                                                        <IconLock
                                                            :size='50'
                                                            :stroke='1'
                                                        />
                                                    </div>
                                                    <div class='d-flex justify-content-center my-3'>
                                                        Once Certificates are generated they cannot be viewed
                                                    </div>
                                                    <div class='d-flex justify-content-center'>
                                                        <button
                                                            class='btn btn-secondary'
                                                            @click='regen = true'
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
                                                        <button
                                                            :disabled='!$route.params.connectionid && !isReady'
                                                            class='cursor-pointer btn btn-primary'
                                                            @click='create'
                                                        >
                                                            Save Connection
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>

        <PageFooter />
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import PageFooter from './PageFooter.vue';
import AgencySelect from './Connection/AgencySelect.vue';
import CertificateP12 from './Connection/CertificateP12.vue';
import CertificateLogin from './Connection/CertificateLogin.vue';
import CertificateRaw from './Connection/CertificateRaw.vue';
import CertificateMachineUser from './Connection/CertificateMachineUser.vue';
import {
    IconLock,
    IconCheck,
    IconTrash,
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
        IconLock,
        IconCheck,
        IconTrash,
        AgencySelect,
        TablerDelete,
        TablerBreadCrumb,
        CertificateP12,
        CertificateRaw,
        CertificateLogin,
        CertificateMachineUser,
        TablerInput,
        TablerLoading,
        PageFooter,
    },
    data: function() {
        return {
            loading: true,
            regen: false,
            type: 'creation',
            modal: {
                upload: false,
            },
            errors: {
                name: '',
                description: '',
            },
            connection: {
                name: '',
                agency: undefined,
                description: '',
                enabled: true,
                integrationId: undefined,
                auth: { cert: '', key: '' }
            }
        }
    },
    computed: {
        isNextReady: function() {
            return this.connection.name.trim().length > 0
                && this.connection.description.trim().length > 0
                && this.connection.agency !== undefined
        },
        isReady: function() {
            return this.connection.auth.cert.trim().length && this.connection.auth.key.trim().length
        }
    },
    mounted: async function() {
        if (this.$route.params.connectionid) {
            await this.fetch();
        } else {
            this.loading = false;
        }
    },
    methods: {
        fetch: async function() {
            this.loading = true;
            this.connection = await std(`/api/connection/${this.$route.params.connectionid}`);
            this.connection.auth = { cert: '', key: '' }
            this.loading = false;
        },
        creation: function(certs) {
            this.connection.auth.cert = certs.cert;
            this.connection.auth.key = certs.key;
        },
        integration: function(integrationId) {
            this.connection.integrationId = integrationId;
        },
        marti: function(certs) {
            this.connection.integrationId = null;
            this.connection.auth.cert = certs.cert;
            this.connection.auth.key = certs.key;
        },
        p12upload: function(certs) {
            this.modal.upload = false;
            this.connection.integrationId = null;
            this.connection.auth.cert = certs.cert;
            this.connection.auth.key = certs.key;
        },
        create: async function() {
            for (const field of ['name', 'description']) {
                if (!this.connection[field]) this.errors[field] = 'Cannot be empty';
                else this.errors[field] = '';
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
