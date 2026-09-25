<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                User Groups
            </h3>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetch'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 60px'>
            <div class='col-12 px-2 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!Object.keys(processChannels).length'
                :create='false'
                label='No Channels'
            />
            <div
                v-else
                class='row row-cards px-2'
            >
                <div
                    v-for='group in processChannels'
                    :key='group.name'
                    class='col-12 col-md-6'
                >
                    <StandardItemChannel
                        :channel='group'
                        @click='setStatus(group, !group.active)'
                    />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router';
import { server } from '../../../std.ts';
import GroupManager from '../../../base/group.ts';
import type { Group, GroupChannel } from '../../../types.ts';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerLoading,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import StandardItemChannel from '../../CloudTAK/util/StandardItemChannel.vue';

const route = useRoute();

const error = ref<Error>();
const loading = ref(true);
const rawChannels = ref<Group[]>([]);

const paging = ref({
    filter: ''
})

function isGroup(value: unknown): value is Group {
    return !!value
        && typeof value === 'object'
        && 'name' in value
        && typeof value.name === 'string'
        && 'direction' in value
        && typeof value.direction === 'string';
}

const processChannels = computed(() => {
    const merged = GroupManager.merge(rawChannels.value);

    const channels: Record<string, GroupChannel> = {};

    merged.sort((a, b) => {
        return (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
    }).forEach((channel) => {
        if (channel.name.toLowerCase().includes(paging.value.filter.toLowerCase())) {
            channels[channel.name] = channel;
        }
    });

    return channels;
});

onMounted(async () => {
    await fetch();
});

async function fetch() {
    loading.value = true;
    error.value = undefined;

    try {
        const { data, error: reqError } = await server.GET('/api/marti/group', {
            params: {
                query: {
                    connection: Number(route.params.connectionid),
                    useCache: true
                }
            }
        });

        if (reqError) throw new Error(reqError.message);

        const channels = data?.data;
        if (!Array.isArray(channels) || !channels.every(isGroup)) {
            throw new Error('Malformed channel response');
        }

        rawChannels.value = channels;
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}

async function setStatus(channel: GroupChannel, active = false) {
    rawChannels.value = rawChannels.value.map((ch) => {
        if (ch.name === channel.name) ch.active = active;
        return ch;
    });

    const { error: reqError } = await server.PUT('/api/marti/group', {
        params: {
            query: {
                connection: Number(route.params.connectionid)
            }
        },
        body: rawChannels.value
    });

    if (reqError) throw new Error(reqError.message);
}
</script>
