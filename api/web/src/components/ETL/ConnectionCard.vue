<template>
    <div class='card-header'>
        <ConnectionStatus :connection='connection' />

        <div class='mx-2 d-flex flex-column'>
            <div
                class='card-title m-0'
                :class='{ "cursor-pointer": clickable }'
                @click='clickable ? router.push(`/connection/${connection.id}`) : null'
                v-text='connection.name'
            />
        </div>

        <div class='ms-auto d-flex align-items-center btn-list'>
            <AgencyBadge :connection='connection' />

            <TablerIconButton
                v-if='!connection.readonly'
                title='Cycle Connection'
                @click='cycle'
            >
                <IconPlugConnected
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerRefreshButton
                :loading='loading'
                @click='refresh'
            />

            <TablerIconButton
                title='Edit'
                @click='router.push(`/connection/${connection.id}/edit`)'
            >
                <IconSettings
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </div>
    </div>
    <div
        v-if='expanded'
        class='card-body'
    >
        <TablerMarkdown :markdown='connection.description' />

        <div class='datagrid mt-3'>
            <div class='datagrid-item'>
                <div class='datagrid-title'>
                    Certificate Valid From
                </div>
                <div
                    class='datagrid-content'
                    v-text='connection.certificate.validFrom'
                />
            </div>
            <div class='datagrid-item'>
                <div class='datagrid-title'>
                    Certificate Valid To
                </div>
                <div
                    class='datagrid-content d-flex'
                    :class='{
                        "rounded bg-red text-white px-2 py-1": new Date(connection.certificate.validTo) < new Date()
                    }'
                >
                    <div v-text='connection.certificate.validTo' />
                    <div
                        v-if='new Date(connection.certificate.validTo) < new Date()'
                        class='ms-auto'
                    >
                        Expired Certificate
                    </div>
                </div>
            </div>
            <div class='datagrid-item'>
                <div class='datagrid-title'>
                    Certificate Subject
                </div>
                <div
                    class='datagrid-content'
                    v-text='connection.certificate.subject'
                />
            </div>
        </div>

        <div
            v-if='connection.readonly'
            class='row g-2'
        >
            <div
                class='col-12 d-flex align-items-center justify-content-center pt-3'
            >
                <TablerDropdown>
                    <template #default>
                        <button class='btn mx-2'>
                            <IconDownload
                                :size='24'
                                stroke='1'
                            />
                            <span class='mx-2'>Download Truststore</span>
                        </button>
                    </template>
                    <template #dropdown>
                        <div class='card'>
                            <div class='card-body row g-2'>
                                <div class='col-12'>
                                    <TablerInput
                                        v-model='certificate.truststorePassword'
                                        label='Choose Certificate Password'
                                        type='password'
                                        autocomplete='off'
                                    />
                                </div>
                                <div class='col-12'>
                                    <button
                                        class='btn btn-primary w-100'
                                        :disabled='!certificate.truststorePassword'
                                        @click='downloadCertificate("truststore")'
                                    >
                                        <IconDownload
                                            :size='24'
                                            stroke='1'
                                        />
                                        <span class='mx-2'>Download Truststore</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </template>
                </TablerDropdown>
                <TablerDropdown>
                    <template #default>
                        <button class='btn mx-2'>
                            <IconDownload
                                :size='24'
                                stroke='1'
                            />
                            <span class='mx-2'>Download Certificate</span>
                        </button>
                    </template>
                    <template #dropdown>
                        <div class='card'>
                            <div class='card-body row g-2'>
                                <div class='col-12'>
                                    <TablerInput
                                        v-model='certificate.clientPassword'
                                        label='Choose Certificate Password'
                                        type='password'
                                        autocomplete='off'
                                    />
                                </div>
                                <div class='col-12'>
                                    <button
                                        class='btn btn-primary w-100'
                                        :disabled='!certificate.clientPassword'
                                        @click='downloadCertificate("client")'
                                    >
                                        <IconDownload
                                            :size='24'
                                            stroke='1'
                                        />
                                        <span class='mx-2'>Download Certificate</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </template>
                </TablerDropdown>
            </div>
        </div>
    </div>
    <div
        v-if='expanded'
        class='card-footer d-flex align-items-center'
    >
        <div>
            Last updated <span v-text='timeDiff(connection.updated)' />
        </div>
        <div class='ms-auto'>
            <InitialAuthor
                :email='connection.username || "Unknown"'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import type { ETLConnection } from '../../types';
import { std, stdurl } from '../../std';
import timeDiff from '../../timediff';
import ConnectionStatus from './Connection/StatusDot.vue';
import AgencyBadge from './Connection/AgencyBadge.vue';
import InitialAuthor from '../util/InitialAuthor.vue';
import {
    TablerIconButton,
    TablerRefreshButton,
    TablerMarkdown,
    TablerDropdown,
    TablerInput
} from '@tak-ps/vue-tabler';
import {
    IconPlugConnected,
    IconSettings,
    IconDownload
} from '@tabler/icons-vue';

const router = useRouter();

const props = withDefaults(defineProps<{
    connection: ETLConnection;
    clickable?: boolean;
    expanded?: boolean;
}>(), {
    clickable: false,
    expanded: false
});

const emit = defineEmits(['update:connection']);

const loading = ref(false);

const certificate = ref({
    truststorePassword: '',
    clientPassword: ''
});

async function cycle() {
    loading.value = true;
    try {
        const updated = await std(`/api/connection/${props.connection.id}/refresh`, {
            method: 'POST'
        }) as ETLConnection;
        emit('update:connection', updated);
    } catch (err) {
        console.error(err);
    }
    loading.value = false;
}

async function refresh() {
    loading.value = true;
    try {
        const updated = await std(`/api/connection/${props.connection.id}`) as ETLConnection;
        emit('update:connection', updated);
    } catch (err) {
        console.error(err);
    }
    loading.value = false;
}

function downloadCertificate(type: 'truststore' | 'client') {
    const url = stdurl(`/api/connection/${props.connection.id}/auth`);
    url.searchParams.set('type', type);
    url.searchParams.set('download', 'true');
    url.searchParams.set('password', type === 'truststore' ? certificate.value.truststorePassword : certificate.value.clientPassword);
    url.searchParams.set('token', localStorage.token);
    window.open(url, '_blank');
}
</script>
