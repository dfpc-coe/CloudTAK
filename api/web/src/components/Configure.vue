<template>
    <div
        class='page page-center'
        style='overflow: auto;'
    >
        <div class='container container-normal py-4'>
            <div class='row align-items-center g-4'>
                <div class='col-lg'>
                    <div class='container-tight'>
                        <div class='card card-md'>
                            <div class='card-body'>
                                <div
                                    class='text-center'
                                    style='margin-bottom: 24px;'
                                >
                                    <img
                                        src='/logo.png'
                                        style='height: 150px;'
                                        alt='CloudTAK System Logo'
                                    >
                                </div>
                                <h2 class='h2 text-center mb-4'>
                                    Welcome to CloudTAK
                                </h2>
                                <h2 class='h4 text-center mb-4'>
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
                                            @keyup.enter='updateServer'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='body.url'
                                            label='Server CoT API'
                                            placeholder='ssl://ops.example.com:8089'
                                            :error='errors.url'
                                            @keyup.enter='updateServer'
                                        />
                                    </div>
                                    <div class='mb-2'>
                                        <TablerInput
                                            v-model='body.api'
                                            label='Server Marti API'
                                            placeholder='https://ops.example.com:8443'
                                            :error='errors.api'
                                            @keyup.enter='updateServer'
                                        />
                                    </div>

                                    <div class='mb-2'>
                                        <label class='mx-2'>Admin Certificate</label>
                                        <CertificateP12
                                            @certs='body.certs = $event'
                                            @err='err = $event'
                                        />
                                    </div>
                                    <div class='form-footer'>
                                        <button
                                            type='submit'
                                            class='btn btn-primary w-100'
                                            @click='updateServer'
                                        >
                                            Configure Server
                                        </button>
                                    </div>
                                </template>
                            </div>
                        </div>
                        <div class='text-center text-muted mt-3'>
                            Don't have account yet? <a href='mailto:nicholas.ingalls@state.co.us'>Contact Us</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang='ts'>
import { std } from '../std.ts';
import type { Server } from '../types.ts';
import CertificateP12 from './Connection/CertificateP12.vue';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler'

export default {
    name: 'InitialConfigure',
    components: {
        CertificateP12,
        TablerInput,
        TablerLoading
    },
    data: function() {
        return {
            loading: false,
            errors: {
                name: '',
                url: '',
                api: ''
            },
            body: {
                name: '',
                url: '',
                api: '',
                certs: {
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
            if (this.body.name.trim().length < 8) {
                this.errors.name = 'Name should be > 8 characters';
            } else {
                this.errors.name = '';
            }

            try {
                const url = new URL(this.body.url)
                if (url.protocol !== 'ssl:') {
                    this.errors.url = 'Protocol should be ssl://'
                } else {
                    this.errors.url = '';
                }
            } catch (err) {
                this.errors.url = err.message;
            }

            try {
                const url = new URL(this.body.api)
                if (url.protocol !== 'https:') {
                    this.errors.api = 'Protocol should be https://'
                } else {
                    this.errors.api = '';
                }
            } catch (err) {
                this.errors.api = err.message;
            }

            for (const e in this.errors) {
                if (this.errors[e]) return;
            }

            this.loading = true;
            await std('/api/server/1', {
                method: 'PATCH',
                body: this.body
            })

            this.$router.push('/login');
        }
    }
}
</script>
