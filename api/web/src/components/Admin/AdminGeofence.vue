<template>
    <div>
        <div class='card-header d-flex align-items-center'>
            <h3 class='card-title mb-0'>
                Geofence Server
            </h3>
            <div class='ms-auto d-flex gap-1'>
                <TablerIconButton
                    v-if='!edit'
                    title='Edit'
                    @click.stop='edit = true'
                >
                    <IconPencil stroke='1' />
                </TablerIconButton>
                <template v-else>
                    <TablerIconButton
                        color='rgba(var(--tblr-primary-rgb), 0.14)'
                        title='Save'
                        @click.stop='save'
                    >
                        <IconDeviceFloppy
                            color='rgb(var(--tblr-primary-rgb))'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerIconButton
                        title='Cancel'
                        @click.stop='edit = false; fetch()'
                    >
                        <IconX stroke='1' />
                    </TablerIconButton>
                </template>
            </div>
        </div>
        <div class='card-body row'>
            <div class='col-12'>
                <div class='py-2 px-2 rounded'>
                    <TablerLoading v-if='loading' />
                    <template v-else>
                        <TablerAlert
                            v-if='err'
                            :err='err'
                        />
                        <div class='row'>
                            <div class='col-lg-12 pb-2'>
                                <div class='rounded cloudtak-accent px-3 py-2'>
                                    <div class='d-flex align-items-center'>
                                        <StatusDot
                                            :status='statusDot'
                                            :title='statusLabel'
                                        />
                                        <div class='ms-2'>
                                            <div class='fw-bold'>
                                                Connection Status
                                            </div>
                                            <div class='text-secondary'>
                                                <span v-text='statusLabel' />
                                                <span
                                                    v-if='status.connected && status.url'
                                                    class='ms-1'
                                                    v-text='`(${status.url})`'
                                                />
                                            </div>
                                        </div>
                                        <div
                                            v-if='status.reconnectAttempts > 0'
                                            class='ms-auto text-secondary small'
                                            v-text='`Reconnect Attempts: ${status.reconnectAttempts}`'
                                        />
                                    </div>
                                    <div
                                        v-if='status.lastError'
                                        class='text-danger small pt-2'
                                        v-text='status.lastError'
                                    />
                                    <div
                                        v-else-if='statusError'
                                        class='text-danger small pt-2'
                                        v-text='statusError.message'
                                    />
                                </div>
                            </div>
                            <div class='col-lg-12'>
                                <TablerToggle
                                    v-model='config["geofence::enabled"]'
                                    :disabled='!edit'
                                    label='Geofence Server Enabled'
                                />
                            </div>
                            <div
                                v-if='config["geofence::enabled"]'
                                class='col-lg-12'
                            >
                                <TablerInput
                                    v-model='config["geofence::url"]'
                                    :disabled='!edit'
                                    :error='validateURL(config["geofence::url"])'
                                    label='Geofence Server URL'
                                />
                                <TablerInput
                                    v-model='config["geofence::password"]'
                                    type='password'
                                    autocomplete='new-password'
                                    :disabled='!edit'
                                    label='Geofence Server Password'
                                />
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import StatusDot from '../util/StatusDot.vue';
import { server, std } from '../../std.ts';
import { validateURL } from '../../base/validators.ts';
import {
    TablerLoading,
    TablerInput,
    TablerToggle,
    TablerIconButton,
    TablerAlert
} from '@tak-ps/vue-tabler';
import {
    IconPencil,
    IconDeviceFloppy,
    IconX
} from '@tabler/icons-vue';

const loading = ref(false);
const edit = ref(false);
const err = ref<Error | null>(null);
const statusError = ref<Error | null>(null);

const status = ref<{
    state: 'disabled' | 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'closing';
    enabled: boolean;
    configured: boolean;
    connected: boolean;
    url: string;
    reconnectAttempts: number;
    lastError?: string;
}>({
    state: 'disabled',
    enabled: false,
    configured: false,
    connected: false,
    url: '',
    reconnectAttempts: 0,
});

const config = ref<{
    'geofence::enabled': boolean;
    'geofence::url': string;
    'geofence::password': string;
}>({
    'geofence::enabled': false,
    'geofence::url': '',
    'geofence::password': '',
});

let statusInterval: ReturnType<typeof setInterval> | undefined;

const statusDot = computed(() => {
    switch (status.value.state) {
        case 'connected': return 'success';
        case 'connecting':
        case 'reconnecting':
        case 'closing': return 'pending';
        case 'error':
        case 'disconnected': return 'fail';
        default: return 'unknown';
    }
});

const statusLabel = computed(() => {
    switch (status.value.state) {
        case 'connected': return 'Connected';
        case 'connecting': return 'Connecting';
        case 'reconnecting': return 'Reconnecting';
        case 'closing': return 'Closing';
        case 'error': return 'Connection Error';
        case 'disconnected': return 'Disconnected';
        case 'disabled': return 'Disabled';
        default: return 'Unknown';
    }
});

onMounted(() => {
    void fetch();
    startStatusPolling();
});

onBeforeUnmount(() => {
    stopStatusPolling();
});

async function fetch() {
    loading.value = true;
    err.value = null;

    try {
        const [configRes] = await Promise.all([
            server.GET('/api/config', {
                params: {
                    query: {
                        keys: Object.keys(config.value).join(',')
                    }
                }
            }),
            fetchStatus()
        ]);

        const { data, error: reqError } = configRes;

        if (reqError) throw new Error(reqError.message);

        config.value = {
            'geofence::enabled': data['geofence::enabled'] ?? false,
            'geofence::url': data['geofence::url'] ?? '',
            'geofence::password': data['geofence::password'] ?? '',
        };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}

async function fetchStatus() {
    statusError.value = null;

    try {
        const data = await std('/api/geofence') as typeof status.value;
        status.value = data;
    } catch (error) {
        statusError.value = error instanceof Error ? error : new Error(String(error));
    }
}

function startStatusPolling() {
    if (statusInterval) return;

    statusInterval = setInterval(() => {
        void fetchStatus();
    }, 5000);
}

function stopStatusPolling() {
    if (!statusInterval) return;

    clearInterval(statusInterval);
    statusInterval = undefined;
}

async function save() {
    loading.value = true;
    err.value = null;

    try {
        const { error: reqError } = await server.PUT('/api/config', {
            body: config.value
        });

        if (reqError) throw new Error(reqError.message);

        edit.value = false;
        await fetchStatus();
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
        console.error('Failed to save Geofence config:', error);
    }

    loading.value = false;
}
</script>