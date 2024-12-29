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
                        <TablerIconButton
                            title='Configure Server'
                            @click='edit = true'
                        >
                            <IconPencil
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
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
                        stroke='1'
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
                            stroke='1'
                        />
                    </div>
                    <div class='col-auto d-flex align-items-center'>
                        Once Certificates are uploaded they cannot be viewed
                    </div>
                    <div
                        v-if='server.certificate'
                        class='row g-2'
                    >
                        <div class='col-lg-4'>
                            <div class='datagrid-title'>
                                Certificate Valid From
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='server.certificate.validFrom'
                            />
                        </div>
                        <div class='col-lg-4'>
                            <div class='datagrid-title'>
                                Certificate Valid To
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='server.certificate.validTo'
                            />
                        </div>
                        <div class='col-lg-4'>
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
            @err='error = $event'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { std } from '../../std.ts';
import type { Server, Server_Update } from '../../types.ts';
import Upload from '../util/UploadP12.vue';
import {
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconLock,
    IconPencil
} from '@tabler/icons-vue';
import timeDiff from '../../timediff.ts';

const edit = ref(false);
const loading = ref(true);
const regen = ref(false);

const modal = ref({
    upload: false
})

const auth = ref({
    cert: '',
    key: ''
})

const error = ref<Error | undefined>();

const errors = ref<Record<string, string>>({
    cert: '',
    key: '',
    name: '',
    url: '',
    api: '',
    webtak: ''
})

const server = ref<Server>({
    id: 0,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    status: 'unconfigured',
    auth: false,
    name: '',
    url: '',
    api: '',
    webtak: '',
});

onMounted(async () => {
    await fetch();

    if (server.value.status === 'unconfigured') {
        edit.value = true;
    }
});

async function fetch() {
    loading.value = true;
    server.value = await std(`/api/server`) as Server;
    if (!server.value.auth) regen.value = true;
    loading.value = false;
}

function p12upload(certs: {
    pemCertificate: string,
    pemKey: string
}) {
    modal.value.upload = false;
    auth.value.cert = certs.pemCertificate
        .split('-----BEGIN CERTIFICATE-----')
        .join('-----BEGIN CERTIFICATE-----\n')
        .split('-----END CERTIFICATE-----')
        .join('\n-----END CERTIFICATE-----');
    auth.value.key = certs.pemKey
        .split('-----BEGIN RSA PRIVATE KEY-----')
        .join('-----BEGIN RSA PRIVATE KEY-----\n')
        .split('-----END RSA PRIVATE KEY-----')
        .join('\n-----END RSA PRIVATE KEY-----');
}

async function postServer() {
    errors.value.api = !server.value.api ? 'Cannot be empty' : '';
    errors.value.url = !server.value.url ? 'Cannot be empty' : '';
    errors.value.name = !server.value.name ? 'Cannot be empty' : '';

    let field: keyof Server;
    let fields: Array<keyof Server> = ['api', 'url', 'webtak'];
    for (field of fields) {
        if (!errors.value[field]) {
            try {
                new URL(String(server.value[field]));
            } catch (err) {
                errors.value[field] = err instanceof Error ? err.message : String(err);
            }
        }
    }

    for (const e in errors.value) if (errors.value[e]) return;

    loading.value = true;
    const body: Server_Update = {
        name: server.value.name,
        url: server.value.url,
        api: server.value.api,
        webtak: server.value.webtak,
    }

    if (auth.value.cert && auth.value.key) {
        body.auth = auth.value;
    }

    if (server.value.status === 'unconfigured') {
        server.value = await std(`/api/server`, {
            method: 'POST', body
        }) as Server;
    } else {
        server.value = await std(`/api/server`, {
            method: 'PATCH', body
        }) as Server;
    }

    auth.value.cert = '';
    auth.value.key = '';
    regen.value = false;
    edit.value = false;
    loading.value = false;
}
</script>
