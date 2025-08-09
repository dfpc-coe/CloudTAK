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

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { std } from '../std.ts';
import type { Server, Server_Update } from '../types.ts';
import CertificateP12 from './ETL/Connection/CertificateP12.vue';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler'
import {
    IconCheck,
    IconTrash
} from '@tabler/icons-vue';

const router = useRouter();

const loading = ref(false);

const errors = ref<Record<string, string>>({
    name: '',
    username: '',
    password: '',
    url: '',
    api: '',
    webtak: ''
})

const body = ref<Server_Update>({
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
})

onMounted(async () => {
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
});

async function updateServer() {
    if (!body.value.name || body.value.name.trim().length < 8) {
        errors.value.name = 'Name should be > 8 characters';
    } else {
        errors.value.name = '';
    }

    if (!body.value.username || body.value.username.trim().length === 0) {
        errors.value.username = 'Username cannot be empty';
    } else {
        errors.value.username = '';
    }

    if (!body.value.password || body.value.password.trim().length === 0) {
        errors.value.password = 'Password cannot be empty';
    } else {
        errors.value.password = '';
    }

    try {
        const url = new URL(body.value.url)
        if (url.protocol !== 'ssl:') {
            errors.value.url = 'Protocol should be ssl://'
        } else {
            errors.value.url = '';
        }
    } catch (err) {
        errors.value.url = err instanceof Error ? err.message : String(err);
    }

    try {
        const url = new URL(body.value.api)
        if (url.protocol !== 'https:') {
            errors.value.api = 'Protocol should be https://'
        } else {
            errors.value.api = '';
        }
    } catch (err) {
        errors.value.url = err instanceof Error ? err.message : String(err);
    }

    for (const e in errors.value) {
        if (errors.value[e]) return;
    }

    loading.value = true;

    try {
        await std('/api/server', {
            method: 'PATCH',
            body: body.value
        })

        router.push('/login');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
