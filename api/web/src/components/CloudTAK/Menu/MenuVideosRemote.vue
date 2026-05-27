<template>
    <MenuTemplate
        name='Remote Video Connection'
        :loading='loading'
        :err='err'
    >
        <template #buttons>
            <TablerDelete
                v-if='route.params.connectionid !== "new"'
                displaytype='icon'
                @delete='deleteConnection'
            />
        </template>
        <template #default>
            <div class='row g-2'>
                <div class='col-12'>
                    <TablerInput
                        v-model='connection.alias'
                        label='Alias'
                    >
                        <TablerToggle
                            v-model='connection.active'
                            label='Active'
                        />
                    </TablerInput>
                </div>
                <div
                    v-if='route.params.connectionid === "new"'
                    class='col-12'
                >
                    <label class='px-2 w-100'>Channels</label>

                    <div style='max-height: 20vh; min-height: 200px; overflow-y: auto;'>
                        <GroupSelect
                            v-model='groups'
                            :active='true'
                            direction='IN'
                        />
                    </div>
                </div>
                <div class='col-12 d-flex'>
                    <label>Feeds</label>

                    <div class='ms-auto'>
                        <TablerIconButton
                            title='Add Feed'
                            @click='newFeed'
                        >
                            <IconPlus
                                :size='24'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>
                <div class='col-12'>
                    <TablerNone
                        v-if='connection.feeds.length === 0'
                        :create='false'
                        :compact='true'
                        label='No Feeds'
                    />
                    <template v-else>
                        <template
                            v-for='(feed, fit) of connection.feeds'
                            :key='feed.uuid'
                        >
                            <VideosRemoteFeed
                                v-model='connection.feeds[fit]'
                                @delete='connection.feeds.splice(fit, 1)'
                            />
                        </template>
                    </template>
                </div>
                <div class='col-12 d-flex pt-3'>
                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='saveConnection'
                        >
                            Save Connection
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import type { paths } from '@cloudtak/api-types';
import MenuTemplate from '../util/MenuTemplate.vue';
import type { VideoConnection, VideoConnectionFeed, VideoConnection_Create } from '../../../types.ts';
import VideosRemoteFeed from './Videos/VideosRemoteFeed.vue';
import { server } from '../../../std.ts';
import { useRoute, useRouter } from 'vue-router';
import GroupSelect from '../../util/GroupSelect.vue';
import {
    TablerInput,
    TablerDelete,
    TablerIconButton,
    TablerNone,
    TablerToggle,
} from '@tak-ps/vue-tabler';

import {
    IconPlus
} from '@tabler/icons-vue';

import { ref, onMounted } from 'vue'

const route = useRoute();
const router = useRouter();
const loading = ref(String(route.params.connectionid) !== "new");
const err = ref<Error | undefined>(undefined);

const groups = ref<string[]>([]);

type VideoConnection_Update = paths['/api/marti/video/{:uid}']['put']['requestBody']['content']['application/json'];

const connection = ref<VideoConnection>({
    uuid: randomUUID(),
    active: true,
    classification: '',
    thumbnail: '',
    alias: '',
    feeds: []
})

onMounted(async () => {
    if (String(route.params.connectionid) !== "new") {
        await fetchConnection()
    } else {
        newFeed();
    }
});

function newFeed() {
    connection.value.feeds.push({
        uuid: randomUUID(),
        alias: "",
        url: "",
        active: true
    } as VideoConnectionFeed)
}

function toVideoConnectionBody(value: VideoConnection): VideoConnection_Update {
    return {
        uuid: value.uuid,
        active: value.active,
        alias: value.alias,
        feeds: value.feeds.map((feed) => {
            return {
                uuid: feed.uuid,
                active: feed.active,
                alias: feed.alias,
                url: feed.url,
            };
        })
    };
}

async function fetchConnection() {
    loading.value = true;

    try {
        const res = await server.GET('/api/marti/video/{:uid}', {
            params: {
                path: {
                    ':uid': String(route.params.connectionid),
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        connection.value = res.data;

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function saveConnection() {
    loading.value = true;

    try {
        if (String(route.params.connectionid) !== 'new') {
            const res = await server.PUT('/api/marti/video/{:uid}', {
                params: {
                    path: {
                        ':uid': connection.value.uuid,
                    }
                },
                body: toVideoConnectionBody(connection.value)
            });

            if (res.error) throw new Error(res.error.message);
        } else {
            const res = await server.POST('/api/marti/video', {
                body: {
                    groups: groups.value,
                    ...toVideoConnectionBody(connection.value)
                } satisfies VideoConnection_Create
            });

            if (res.error) throw new Error(res.error.message);
        }

        router.push(`/menu/videos`)

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deleteConnection(): Promise<void> {
    loading.value = true;

    try {
        const res = await server.DELETE('/api/marti/video/{:uid}', {
            params: {
                path: {
                    ':uid': String(route.params.connectionid),
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        router.push(`/menu/videos`)
    } catch (err) {
        loading.value = false;

        throw err;
    }
}
</script>
