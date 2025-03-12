<template>
    <div class='card mx-2 px-0'>
        <div class='card-body'>
            <TablerLoading v-if='loading.gen' />
            <template v-else>
                <div
                    v-for='(channel, it) in selected'
                    class='card my-2'
                >
                    <div class='col-12 d-flex align-items-center px-2 py-2'>
                        <div v-text='channel.rdn' />
                        <div class='ms-auto btn-list'>
                            <TablerEnum
                                default='Read-Write'
                                :options='[
                                    "Read",
                                    "Write",
                                    "Read-Write"
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
                        icon='search'
                        v-model='paging.filter'
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
                        label='Channels'
                    />
                    <template
                        v-for='channel in filteredChannels'
                        v-else
                    >
                        <div
                            class='hover-light px-2 py-2 cursor-pointer row'
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
        <div class='card-footer'>
            <button
                :disabled='loading.gen || !selected.length'
                class='cursor-pointer btn btn-primary w-100'
                @click='generate'
            >
                Create Machine User
            </button>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, computed, onMounted } from 'vue';
import type { ETLConnection, ETLChannelList } from '../../types.ts';
import { std, stdurl } from '../../std.ts';
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

const props = defineProps<{
    connection: ETLConnection
}>();

const emit = defineEmits([ 'integration' ]);

const loading = ref({
    gen: false,
    channels: true
});

const paging = ref({
    filter: ''
});

const channels = ref<ETLChannelList>({
    total: 0,
    items: []
});

const selected = ref([]);

const filteredChannels = computed(() => {
    return channels.value.items.filter((ch) => {
        for (const sel of selected.value) {
            if (ch.id === sel.id) return false;
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

function push(channel) {
    paging.value.filter = '';

    for (const ch of selected.value) {
        if (ch.id === channel.id) return;
    }
    selected.value.push(channel);
}

async function listChannels() {
    loading.value.channels = true;

    try {
        const url = stdurl('/api/ldap/channel');
        if (props.connection.agency) {
            url.searchParams.append('agency', props.connection.agency);
        }
        url.searchParams.append('filter', paging.value.filter);
        channels.value = await std(url) as ETLChannelList
    } catch (err) {
        loading.value.channels = false;
        throw err;
    }
    loading.value.channels = false;
}

async function generate() {
    loading.value.gen = true;
    const url = stdurl('/api/ldap/user');
    const res = await std(url, {
        method: 'POST',
        body: {
            name: props.connection.name,
            description: props.connection.description,
            agency_id: props.connection.agency,
            channels: selected.value.map((s) => { return s.id })
        }
    })

    loading.value.gen = true;
    emit('integration', {
        'certs': res.auth,
        'integrationId': res.integrationId
    });
}
</script>
