<template>
    <div>
        <TablerLoading v-if='loading' />
        <template v-else>
            <div class='card-header'>
                <h3 class='card-title'>
                    TAK Server Configuration
                </h3>
                <div class='ms-auto'>
                    <div class='btn-list'>
                        <IconSettings
                            v-tooltip='"Configure Server"'
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            @click='edit = true'
                        />
                    </div>
                </div>
            </div>
            <div class='card-body row'>
                <div class='col-lg-12 py-2'>
                    <TablerInput
                        v-model='server.name'
                        :disabled='!edit'
                        label='TAK Server Name'
                        placeholder='ssl://'
                        :error='errors.name'
                    />
                </div>

                <div class='col-lg-12 py-2'>
                    <TablerInput
                        v-model='server.url'
                        :disabled='!edit'
                        label='TAK Server Streaming CoT'
                        placeholder='ssl://'
                        :error='errors.url'
                    />
                </div>
                <div class='col-lg-12 py-2'>
                    <TablerInput
                        v-model='server.api'
                        :disabled='!edit'
                        label='TAK Server API'
                        placeholder='https://'
                        :error='errors.api'
                    />
                </div>
                <div class='col-lg-12 py-2'>
                    <TablerInput
                        v-model='server.webtak'
                        :disabled='!edit'
                        label='TAK Server WebTAK (Public API)'
                        placeholder='https://'
                        :error='errors.webtak'
                    />
                </div>
            </div>
            <div class='card-header'>
                <h3 class='card-title'>
                    Admin Certificate
                </h3>
                <div
                    v-if='regen && edit'
                    class='ms-auto btn-list'
                >
                    <IconPlus
                        v-tooltip='"Upload P12"'
                        :size='32'
                        :stroke='1'
                        class='cursor-pointer'
                        @click='modal.upload = true'
                    />
                </div>
            </div>
            <div class='card-body row'>
                <template v-if='regen && edit'>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='auth.cert'
                            label='Connection Cert'
                            :error='errors.cert'
                            :rows='6'
                        />
                    </div>
                    <div class='col-md-6'>
                        <TablerInput
                            v-model='auth.key'
                            label='Connection Key'
                            :error='errors.key'
                            :rows='6'
                        />
                    </div>
                </template>
                <template v-else>
                    <div class='col-auto'>
                        <IconLock
                            :size='50'
                            :stroke='1'
                        />
                    </div>
                    <div class='col-auto d-flex align-items-center'>
                        Once Certificates are uploaded they cannot be viewed
                    </div>
                    <div class='col-12 datagrid pt-2 pb-5'>
                        <div class='datagrid-item pb-2'>
                            <div class='datagrid-title'>
                                Certificate Valid From
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='server.certificate.validFrom'
                            />
                        </div>
                        <div class='datagrid-item pb-2'>
                            <div class='datagrid-title'>
                                Certificate Valid To
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='server.certificate.validTo'
                            />
                        </div>
                        <div class='datagrid-item pb-2'>
                            <div class='datagrid-title'>
                                Certificate Subject
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='server.certificate.subject'
                            />
                        </div>
                    </div>
                    <div
                        v-if='edit'
                        class='col-auto ms-auto'
                    >
                        <button
                            class='btn btn-secondary'
                            @click='regen=true'
                        >
                            Replace Certificate
                        </button>
                    </div>
                </template>

                <div
                    v-if='edit'
                    class='col-lg-12 d-flex py-2'
                >
                    <div class='ms-auto'>
                        <div
                            class='btn btn-primary'
                            @click='postServer'
                        >
                            Save Server
                        </div>
                    </div>
                </div>
            </div>
            <div
                class='position-absolute bottom-0 w-100'
                style='height: 53px;'
            >
                <div
                    v-if='server.updated'
                    class='card-footer'
                >
                    <span v-text='`Last Updated: ${timeDiff(server.updated)}`' />
                </div>
            </div>
        </template>
        <Upload
            v-if='modal.upload'
            @certs='p12upload($event)'
            @close='modal.upload = false'
            @err='err = $event'
        />
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import Upload from '../util/UploadP12.vue';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconLock,
    IconSettings
} from '@tabler/icons-vue';
import timeDiff from '../../timediff.ts';

export default {
    name: 'AdminServer',
    components: {
        IconSettings,
        TablerLoading,
        TablerInput,
        IconLock,
        IconPlus,
        Upload
    },
    data: function() {
        return {
            edit: false,
            loading: true,
            regen: false,
            modal: {
                upload: false
            },
            auth: {
                cert: '',
                key: ''
            },
            errors: {
                cert: '',
                key: '',
                name: '',
                url: '',
                api: '',
                webtak: ''
            },
            server: {
                id: null,
                created: null,
                updated: null,
                name: '',
                url: '',
                api: '',
                webtak: '',
            }
        }
    },
    mounted: async function() {
        await this.fetch();

        if (this.server.status === 'unconfigured') this.edit = true;
    },
    methods: {
        timeDiff: function(updated) {
            return timeDiff(updated);
        },
        fetch: async function() {
            this.loading = true;
            this.server = await std(`/api/server`);
            if (!this.server.auth) this.regen = true;
            this.loading = false;
        },
        p12upload: function(certs) {
            this.modal.upload = false;
            this.auth.cert = certs.pemCertificate
                .split('-----BEGIN CERTIFICATE-----')
                .join('-----BEGIN CERTIFICATE-----\n')
                .split('-----END CERTIFICATE-----')
                .join('\n-----END CERTIFICATE-----');
            this.auth.key = certs.pemKey
                .split('-----BEGIN RSA PRIVATE KEY-----')
                .join('-----BEGIN RSA PRIVATE KEY-----\n')
                .split('-----END RSA PRIVATE KEY-----')
                .join('\n-----END RSA PRIVATE KEY-----');
        },
        postServer: async function() {
            for (const field of ['api', 'url', 'name']) {
                this.errors[field] = !this.server[field] ? 'Cannot be empty' : '';
            }

            for (const field of ['api', 'url', 'webtak']) {
                if (!this.errors[field]) {
                    try {
                        new URL(this.server[field]);
                    } catch (err) {
                        this.errors[field] = err.message;
                    }
                }
            }

            for (const e in this.errors) if (this.errors[e]) return;

            this.loading = true;
            const body = {
                name: this.server.name,
                url: this.server.url,
                api: this.server.api,
                webtak: this.server.webtak,
            }

            if (this.auth.cert && this.auth.key) {
                body.auth = this.auth;
            }

            if (this.server.status === 'unconfigured') {
                this.server = await std(`/api/server`, {
                    method: 'POST', body
                });
            } else {
                this.server = await std(`/api/server`, {
                    method: 'PATCH', body
                });
            }

            this.auth.cert = '';
            this.auth.key = '';
            this.regen = false;
            this.edit = false;
            this.loading = false;
        }
    }
}
</script>
