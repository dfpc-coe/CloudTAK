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
                                    <div class='row g-2'>
                                        <div class='col-12'>
                                            <TablerInput
                                                v-model='body.name'
                                                :error='errors.name'
                                                label='Server Name'
                                                placeholder='TAK Server Name'
                                                description='Human Readable name for the server'
                                                @keyup.enter='updateServer'
                                            />
                                        </div>
                                        <div class='col-12'>
                                            <TablerInput
                                                v-model='helper.hostname'
                                                label='Server Hostname'
                                                placeholder='ops.example.com'
                                                description='Hostname or IP address of the TAK Server'
                                                :error='errors.hostname'
                                                @keyup.enter='updateServer'
                                            />
                                        </div>
                                        <div class='col-md-4 col-12'>
                                            <TablerInput
                                                v-model='helper.stream'
                                                type='number'
                                                label='CoT Port'
                                                placeholder='8089'
                                                description='Streaming COT API - Usually on port 8089'
                                                @keyup.enter='updateServer'
                                            />
                                        </div>
                                        <div class='col-md-4 col-12'>
                                            <TablerInput
                                                v-model='helper.api'
                                                type='number'
                                                label='Marti Port'
                                                placeholder='8443'
                                                description='Marti API - Usually on port 8443'
                                                @keyup.enter='updateServer'
                                            />
                                        </div>
                                        <div class='col-md-4 col-12'>
                                            <TablerInput
                                                v-model='helper.webtak'
                                                type='number'
                                                label='WebTAK'
                                                placeholder='8446'
                                                description='WebTAK API - Usually on port 8446'
                                                :error='errors.url'
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
                                                label='Initial Administrator Username'
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
                                                label='Initial Administrator Password'
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
    hostname: ''
})

const helper = ref({
    hostname: '',
    stream: 8089,
    webtak: 8446,
    api: 8443,
});

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

    if (!helper.value.hostname || helper.value.hostname.trim().length === 0) {
        errors.value.hostname = 'Hostname cannot be empty';
    } else {
        errors.value.hostname = '';
    }

    for (const e in errors.value) {
        if (errors.value[e]) return;
    }

    body.value.url = `ssl://${helper.value.hostname}:${helper.value.stream}`;
    body.value.api = `https://${helper.value.hostname}:${helper.value.api}`;
    body.value.webtak = `https://${helper.value.hostname}:${helper.value.webtak}`;

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
