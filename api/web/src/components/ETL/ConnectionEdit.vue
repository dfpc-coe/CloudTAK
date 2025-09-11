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
                            <TablerLoading
                                class='text-white'
                            />
                        </template>
                        <template v-else>
                            <div class='card'>
                                <div class='card-header'>
                                    <h3
                                        v-if='route.params.connectionid'
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

                                    <div
                                        v-if='route.params.connectionid && connection.readonly !== true'
                                        class='ms-auto d-flex btn-list'
                                    >
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
                                <div class='card-body'>
                                    <div class='row row-cards'>
                                        <div class='col-md-12 mt-3'>
                                            <TablerInput
                                                v-model='connection.name'
                                                label='Name'
                                                :error='errors.name'
                                                description='The human readable name of the Connection'
                                            />
                                        </div>

                                        <div class='col-md-12'>
                                            <div
                                                class='px-2 py-2 round btn-group w-100'
                                                role='group'
                                            >
                                                <input
                                                    id='connection-readonly-false'
                                                    type='radio'
                                                    class='btn-check'
                                                    autocomplete='off'
                                                    :disabled='route.params.connectionid'
                                                    :checked='!connection.readonly'
                                                    @click='connection.readonly = false'
                                                >
                                                <label
                                                    for='connection-readonly-false'
                                                    type='button'
                                                    class='btn btn-sm'
                                                ><IconCloud
                                                    v-tooltip='"Cloud Integration"'
                                                    :size='32'
                                                    stroke='1'
                                                /><span class='mx-2'>Cloud Integration</span></label>

                                                <input
                                                    id='connection-readonly-true'
                                                    type='radio'
                                                    class='btn-check'
                                                    autocomplete='off'
                                                    :disabled='route.params.connectionid'
                                                    :checked='connection.readonly'
                                                    @click='connection.readonly = true'
                                                >
                                                <label
                                                    for='connection-readonly-true'
                                                    type='button'
                                                    class='btn btn-sm'
                                                ><IconDrone
                                                    v-tooltip='"External Integration"'
                                                    :size='32'
                                                    stroke='1'
                                                /><span class='mx-2'>External Integration</span></label>
                                            </div>
                                        </div>
                                        <div class='col-md-12'>
                                            <TablerInput
                                                v-model='connection.description'
                                                label='Description'
                                                description='
                                                    Human readable details about what the connection contains or is used for
                                                '
                                                :error='errors.description'
                                                :rows='6'
                                            />
                                        </div>
                                        <div class='col-md-12'>
                                            <AgencySelect
                                                v-if='!agencyDisabled'
                                                v-model='connection.agency'
                                                @disabled='disableAgency'
                                                label='Agency Owner'
                                            />
                                        </div>
                                    </div>
                                </div>

                                <template v-if='isNextReady || route.params.connectionid'>
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
                                                        <TablerIconButton
                                                            title='Remove Certificate'
                                                            @click='marti({ key: "", cert: ""})'
                                                        >
                                                            <IconTrash
                                                                :size='32'
                                                                stroke='1'
                                                            />
                                                        </TablerIconButton>
                                                    </div>
                                                </div>
                                            </template>
                                            <template v-else-if='!route.params.connectionid || regen'>
                                                <div class='col-12 pb-2'>
                                                    <div
                                                        class='btn-group w-100'
                                                        role='group'
                                                    >
                                                        <template v-if='!agencyDisabled'>
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
                                                        </template>

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
                                                <template v-else-if='!agencyDisabled && type === "creation"'>
                                                    <CertificateMachineUser
                                                        :connection='connection'
                                                        @certs='p12upload($event)'
                                                        @integration='creation($event)'
                                                        @err='err = $event'
                                                    />
                                                </template>
                                            </template>
                                            <template v-else>
                                                <div class='border px-3 py-3'>
                                                    <div class='d-flex justify-content-center'>
                                                        <IconLock
                                                            :size='50'
                                                            stroke='1'
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
                                                        v-if='route.params.connectionid'
                                                        label='Delete Connection'
                                                        @delete='del'
                                                    />

                                                    <div class='ms-auto'>
                                                        <button
                                                            :disabled='!route.params.connectionid && !isReady'
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

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std } from '../../std.ts';
import PageFooter from '../PageFooter.vue';
import AgencySelect from './Connection/AgencySelect.vue';
import CertificateP12 from './Connection/CertificateP12.vue';
import CertificateLogin from './Connection/CertificateLogin.vue';
import CertificateRaw from './Connection/CertificateRaw.vue';
import CertificateMachineUser from './Connection/CertificateMachineUser.vue';
import {
    IconLock,
    IconCloud,
    IconDrone,
    IconCheck,
    IconTrash,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerIconButton,
    TablerBreadCrumb,
    TablerDelete,
    TablerInput
} from '@tak-ps/vue-tabler';

const router = useRouter();
const route = useRoute();

const loading = ref(true);
const regen = ref(false);
const type = ref('creation');
const modal = ref({
    upload: false,
})

const errors = ref({
    name: '',
    description: '',
});

const agencyDisabled = ref(false);

const connection = ref({
    name: '',
    agency: undefined,
    readonly: false,
    description: '',
    enabled: true,
    integrationId: undefined,
    auth: { cert: '', key: '' }
});

const isNextReady = computed(() => {
    return connection.value.name.trim().length > 0
        && connection.value.description.trim().length > 0
        && connection.value.agency !== undefined
});

const isReady = computed(() => {
    return connection.value.auth.cert.trim().length && connection.value.auth.key.trim().length
});

onMounted(async () => {
    if (route.params.connectionid) {
        await fetch();
    } else {
        loading.value = false;
    }
});

function disableAgency() {
    agencyDisabled.value = true;
    type.value = 'login'
    connection.value.agency = null;
}

async function fetch() {
    loading.value = true;
    connection.value = await std(`/api/connection/${route.params.connectionid}`);
    connection.value.auth = { cert: '', key: '' }
    loading.value = false;
}

function creation(integration) {
    connection.value.integrationId = integration.integrationId;
    connection.value.auth.cert = integration.certs.cert;
    connection.value.auth.key = integration.certs.key;
}

function marti(certs) {
    connection.value.integrationId = null;
    connection.value.auth.cert = certs.cert;
    connection.value.auth.key = certs.key;
}

async function p12upload(certs) {
    modal.value.upload = false;
    connection.value.integrationId = null;
    connection.value.auth.cert = certs.cert;
    connection.value.auth.key = certs.key;
}

async function create() {
    for (const field of ['name', 'description']) {
        if (!connection.value[field]) errors.value[field] = 'Cannot be empty';
        else errors.value[field] = '';
    }

    for (const e in errors.value) {
        if (errors.value[e]) return;
    }

    if (route.params.connectionid) {
        const body = JSON.parse(JSON.stringify(connection.value));
        if (!regen.value) delete body.auth;

        const create = await std(`/api/connection/${route.params.connectionid}`, {
            method: 'PATCH',
            body: body
        });
        router.push(`/connection/${create.id}`);
    } else {
        const create = await std('/api/connection', {
            method: 'POST',
            body: connection.value
        });
        router.push(`/connection/${create.id}`);
    }
}

async function del() {
    await std(`/api/connection/${route.params.connectionid}`, {
        method: 'DELETE'
    });
    router.push('/connection');
}
</script>
