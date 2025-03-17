<template>
    <div
        class='page page-center'
        style='overflow: auto;'
    >
        <div class='container container-normal py-4'>
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div
                            class='text-center'
                            style='margin-bottom: 24px;'
                        >
                            <img
                                class='d-none d-md-inline'
                                style='
                                    height: 150px;
                                '
                                src='/CloudTAKLogoText.svg'
                                alt='CloudTAK System Logo'
                            >
                        </div>
                        <div class='card card-md'>
                            <div class='card-body'>
                                <h2 class='h2 text-center mb-4'>
                                    Initial Server Configuration
                                </h2>
                                <TablerLoading v-if='loading' />
                                <template v-else>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='body.name'
                                            :error='errors.name'
                                            label='Server Name'
                                            placeholder='TAK Server Name'
                                            description='Human Readable name for the server'
                                            @keyup.enter='updateServer'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='body.url'
                                            label='Server CoT API'
                                            placeholder='ssl://ops.example.com:8089'
                                            description='Streaming COT API - Usually on port 8089'
                                            :error='errors.url'
                                            @keyup.enter='updateServer'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='body.api'
                                            label='Server Marti API'
                                            description='Marti API - Usually on port 8443'
                                            placeholder='https://ops.example.com:8443'
                                            :error='errors.api'
                                            @keyup.enter='updateServer'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='body.webtak'
                                            label='Server Cert Issuance API'
                                            description='Marti WebAPI - Usually on port 8446 - Must use a publically trusted SSL cert and not a self-signed cert'
                                            placeholder='https://ops.example.com:8446'
                                            :error='errors.webtak'
                                            @keyup.enter='updateServer'
                                        />
                                    </div>

                                    <div class='mb-2'>
                                        <label class='mx-2'>Admin Certificate</label>
                                        <CertificateP12
                                            v-if='!body.auth || !body.auth.cert || !body.auth.key'
                                            @certs='body.auth = $event'
                                        />

                                        <template v-else>
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
                                                        stroke='1'
                                                        class='cursor-pointer'
                                                        @click='body.auth = { cert: "", key: "" };'
                                                    />
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='body.username'
                                            label='Administrator Username'
                                            description='An existing TAK user to use as an initial CloudTAK System Administrator - The TAK Server must respond with a cert for this username/password combo'
                                            autocomplete='username'
                                            :error='errors.username'
                                            @keyup.enter='updateServer'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='body.password'
                                            type='password'
                                            label='Administrator Password'
                                            description='An existing TAK user to use as an initial CloudTAK System Administrator - The TAK Server must respond with a cert for this username/password combo'
                                            autocomplete='password'
                                            :error='errors.password'
                                            @keyup.enter='updateServer'
                                        />
                                    </div>
                                    <div class='form-footer'>
                                        <button
                                            type='submit'
                                            class='btn btn-primary w-100'
                                            :disabled='!body.auth || !body.auth.key'
                                            @click='updateServer'
                                        >
                                            Configure Server
                                        </button>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang='ts'>
import { std } from '../std.ts';
import type { Server, Server_Update } from '../types.ts';
import CertificateP12 from './Connection/CertificateP12.vue';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler'
import {
    IconCheck,
    IconTrash
} from '@tabler/icons-vue';

export default {
    name: 'InitialConfigure',
    components: {
        IconCheck,
        IconTrash,
        CertificateP12,
        TablerInput,
        TablerLoading
    },
    data: function(): {
        loading: boolean;
        errors: Record<string, string>;
        body: Server_Update;
    } {
        return {
            loading: false,
            errors: {
                name: '',
                username: '',
                password: '',
                url: '',
                api: '',
                webtak: ''
            },
            body: {
                name: '',
                url: '',
                api: '',
                webtak: '',
                username: '',
                password: '',
                auth: {
                    key: '',
                    cert: ''
                }
            }
        }
    },
    mounted: async function() {
        let server;
        try {
            server = await std('/api/server') as Server;
        } catch (err) {
            console.error(err);
        }

        if (!server || server.status === 'configured') {
            delete localStorage.token;
            window.location.href = '/login';
        }
    },
    methods: {
        updateServer: async function() {
            if (!this.body.name || this.body.name.trim().length < 8) {
                this.errors.name = 'Name should be > 8 characters';
            } else {
                this.errors.name = '';
            }

            if (!this.body.username || this.body.username.trim().length === 0) {
                this.errors.username = 'Username cannot be empty';
            } else {
                this.errors.username = '';
            }

            if (!this.body.password || this.body.password.trim().length === 0) {
                this.errors.password = 'Password cannot be empty';
            } else {
                this.errors.password = '';
            }

            try {
                const url = new URL(this.body.url)
                if (url.protocol !== 'ssl:') {
                    this.errors.url = 'Protocol should be ssl://'
                } else {
                    this.errors.url = '';
                }
            } catch (err) {
                this.errors.url = err instanceof Error ? err.message : String(err);
            }

            try {
                const url = new URL(this.body.api)
                if (url.protocol !== 'https:') {
                    this.errors.api = 'Protocol should be https://'
                } else {
                    this.errors.api = '';
                }
            } catch (err) {
                this.errors.url = err instanceof Error ? err.message : String(err);
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            this.loading = true;

            try {
                await std('/api/server', {
                    method: 'PATCH',
                    body: this.body
                })

                this.$router.push('/login');
            } catch (err) {
                this.loading = false;
                throw err;
            }
        }
    }
}
</script>
