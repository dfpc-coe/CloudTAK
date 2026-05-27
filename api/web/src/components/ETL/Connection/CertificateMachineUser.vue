<template>
    <div class='card mx-2 px-0'>
        <TablerLoading v-if='loading.gen' />
        <div
            v-else-if='!connection.certificate'
            class='card-body'
        >
            <div
                v-for='(sel, it) in selected'
                class='card my-2'
            >
                <div class='col-12 d-flex align-items-center px-2 py-2'>
                    <div v-text='sel.channel.rdn' />
                    <div class='ms-auto btn-list'>
                        <TablerEnum
                            v-model='sel.access'
                            default='Duplex'
                            :options='[
                                "Read",
                                "Write",
                                "Duplex"
                            ]'
                        />

                        <TablerIconButton
                            title='Remove Channel'
                            @click='selected.splice(it, 1)'
                        >
                            <IconTrash
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>
            </div>
            <div class='col-12 mb-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Channels Filter...'
                    @keyup.enter='generate'
                />
            </div>
            <div class='col-12'>
                <TablerLoading
                    v-if='loading.channels'
                    desc='Loading Channels'
                />
                <TablerNone
                    v-else-if='filteredChannels.length === 0'
                    :compact='true'
                    :create='false'
                    label='No Channels'
                />
                <template
                    v-for='channel in filteredChannels'
                    v-else
                >
                    <div
                        class='cloudtak-hover px-2 py-2 cursor-pointer row'
                        @click='push(channel)'
                    >
                        <div class='col-md-4'>
                            <span v-text='channel.rdn' />
                        </div>

                        <div
                            class='col-md-8'
                            v-text='channel.description'
                        />
                    </div>
                </template>
            </div>
        </div>
        <div class='card-footer'>
            <button
                v-if='!connection.certificate'
                :disabled='loading.gen || !selected.length'
                class='cursor-pointer btn btn-primary w-100'
                @click='generate'
            >
                Create Machine User
            </button>
            <button
                v-else
                class='cursor-pointer btn btn-primary w-100'
                :disabled='loading.gen'
                @click='regenerate'
            >
                Regenerate Certificate
            </button>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, computed, onMounted } from 'vue';
import type { ETLLdapChannelList, ETLLdapChannel } from '../../../types.ts';
import { server } from '../../../std.ts';
import {
    TablerNone,
    TablerEnum,
    TablerInput,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconTrash
} from '@tabler/icons-vue';

interface MachineUserConnection {
    agency: number | null;
    certificate?: {
        subject: string;
    };
    name: string;
    description: string;
    readonly: boolean;
}

const props = defineProps<{
    connection: MachineUserConnection
}>();

const emit = defineEmits([ 'certs', 'integration' ]);

const loading = ref({
    gen: false,
    channels: true
});

const paging = ref({
    filter: ''
});

const channels = ref<ETLLdapChannelList>({
    total: 0,
    items: []
});

const selected = ref<Array<{
    access: string
    channel: ETLLdapChannel
}>>([]);

const filteredChannels = computed(() => {
    return channels.value.items.filter((ch) => {
        for (const sel of selected.value) {
            if (ch.id === sel.channel.id) return false;
        }

        return true;
    })
});

watch(props.connection, async (newConnection, oldConnection) => {
    if (newConnection.agency !== oldConnection.agency) {
        await listChannels();
    }
});

watch(paging.value, async () => {
    await listChannels();
});

onMounted(async () => {
    await listChannels();
});

function push(channel: ETLLdapChannel) {
    paging.value.filter = '';

    for (const sel of selected.value) {
        if (sel.channel.id === channel.id) return;
    }
    selected.value.push({
        access: 'Duplex',
        channel
    });
}

async function listChannels() {
    loading.value.channels = true;

    try {
        const res = await server.GET('/api/ldap/channel', {
            params: {
                query: {
                    ...(props.connection.agency ? { agency: props.connection.agency } : {}),
                    filter: paging.value.filter,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        channels.value = res.data as ETLLdapChannelList;
    } catch (err) {
        loading.value.channels = false;
        throw err;
    }
    loading.value.channels = false;
}

async function regenerate() {
    loading.value.gen = true;

    const certificate = props.connection.certificate;
    if (!certificate) {
        loading.value.gen = false;
        return;
    }

    const email = certificate.subject.split('=')[3];

    const res = await server.PUT('/api/ldap/user/{:email}', {
        params: {
            path: {
                ':email': email,
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    loading.value.gen = false;

    emit('certs', res.data.auth);
    emit('integration', res.data.integrationId);
}

async function generate() {
    loading.value.gen = true;
    try {
        const res = await server.POST('/api/ldap/user', {
            body: {
                name: props.connection.name,
                description: props.connection.description,
                ...(props.connection.agency ? { agency_id: props.connection.agency } : {}),
                locking: !props.connection.readonly,
                channels: selected.value.map((s) => {
                    return {
                        id: s.channel.id,
                        access: s.access.toLowerCase() as 'read' | 'write' | 'duplex'
                    }
                })
            }
        });

        if (res.error) throw new Error(res.error.message);

        loading.value.gen = false;
        emit('certs', res.data.auth);
        emit('integration', res.data.integrationId);
    } catch (err) {
        loading.value.gen = false;
        throw err;
    }
}
</script>
