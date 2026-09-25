<template>
    <div v-if='loading.current || error || managed'>
        <div class='card-header'>
            <h3 class='card-title'>
                Connection Channels
            </h3>
        </div>
        <div class='card-body'>
            <TablerLoading
                v-if='loading.current'
                desc='Loading Channels'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <template v-else>
                <div
                    v-for='cur in current'
                    :key='cur.channel.id'
                    class='card my-2'
                >
                    <div class='col-12 d-flex align-items-center px-2 py-2'>
                        <div
                            :class='{ "text-decoration-line-through text-muted": cur.remove }'
                            v-text='cur.channel.rdn'
                        />
                        <div class='ms-auto btn-list'>
                            <TablerEnum
                                v-if='!cur.remove'
                                v-model='cur.access'
                                default='Unchanged'
                                :options='[
                                    "Unchanged",
                                    "Read",
                                    "Write",
                                    "Duplex"
                                ]'
                            />

                            <TablerIconButton
                                v-if='cur.remove'
                                title='Keep Channel'
                                @click='cur.remove = false'
                            >
                                <IconArrowBackUp
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerIconButton
                                v-else
                                title='Remove Channel'
                                @click='cur.remove = true'
                            >
                                <IconTrash
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>
                </div>
                <div
                    v-for='(sel, it) in selected'
                    :key='sel.channel.id'
                    class='card my-2'
                >
                    <div class='col-12 d-flex align-items-center px-2 py-2'>
                        <div v-text='sel.channel.rdn' />
                        <span class='badge bg-green-lt mx-2'>New</span>
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

                <div
                    v-if='isEmpty'
                    class='text-danger my-2'
                >
                    The connection must remain a member of at least one channel
                </div>

                <div class='col-12 my-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Channels Filter...'
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
                        :key='channel.id'
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
            </template>
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
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconTrash,
    IconArrowBackUp
} from '@tabler/icons-vue';

type ChannelAccess = 'read' | 'write' | 'duplex';

export interface ChannelChanges {
    attach: Array<{ id: number; access: ChannelAccess }>;
    detach: Array<number>;
    valid: boolean;
}

const props = defineProps<{
    connection: {
        id?: number;
        agency: number | null;
    }
}>();

// Pending membership changes - the parent is responsible for submitting them when the Connection is saved
const changes = defineModel<ChannelChanges>({
    default: () => ({ attach: [], detach: [], valid: true })
});

const loading = ref({
    current: true,
    channels: true
});

const error = ref<Error | undefined>();
const managed = ref(false);

const paging = ref({
    filter: ''
});

const channels = ref<ETLLdapChannelList>({
    total: 0,
    items: []
});

// The access type of an existing membership isn't exposed by the provider so it is "Unchanged" unless explicitly set
const current = ref<Array<{
    access: string
    remove: boolean
    channel: ETLLdapChannel
}>>([]);

const selected = ref<Array<{
    access: string
    channel: ETLLdapChannel
}>>([]);

const filteredChannels = computed(() => {
    return channels.value.items.filter((ch) => {
        for (const cur of current.value) {
            if (ch.id === cur.channel.id) return false;
        }

        for (const sel of selected.value) {
            if (ch.id === sel.channel.id) return false;
        }

        return true;
    })
});

// Only a connection that had channels is held to keeping one - an empty
// membership list is not a pending removal
const isEmpty = computed(() => {
    return current.value.length > 0 && current.value.every((cur) => cur.remove) && !selected.value.length;
});

watch([current, selected], () => {
    const attach: ChannelChanges['attach'] = [];
    const detach: ChannelChanges['detach'] = [];

    for (const cur of current.value) {
        if (cur.remove) {
            detach.push(cur.channel.id);
        } else if (cur.access !== 'Unchanged') {
            // Changing access requires the membership to be recreated
            detach.push(cur.channel.id);
            attach.push({ id: cur.channel.id, access: cur.access.toLowerCase() as ChannelAccess });
        }
    }

    for (const sel of selected.value) {
        attach.push({ id: sel.channel.id, access: sel.access.toLowerCase() as ChannelAccess });
    }

    changes.value = { attach, detach, valid: !isEmpty.value };
}, { deep: true });

watch(() => props.connection.agency, async () => {
    if (managed.value) await listChannels();
});

watch(paging.value, async () => {
    await listChannels();
});

onMounted(async () => {
    await fetchCurrent();
    if (managed.value) await listChannels();
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

async function fetchCurrent() {
    loading.value.current = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/connection/{:connectionid}/channel', {
            params: {
                path: {
                    ':connectionid': Number(props.connection.id)
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        managed.value = res.data.managed;
        current.value = res.data.items.map((channel) => {
            return { access: 'Unchanged', remove: false, channel };
        });
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.current = false;
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
</script>
