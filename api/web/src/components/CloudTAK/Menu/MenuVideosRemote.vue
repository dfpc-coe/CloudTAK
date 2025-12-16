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
            <div class='row g-2 px-2'>
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
                        label='Feeds'
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
import MenuTemplate from '../util/MenuTemplate.vue';
import type { VideoConnection, VideoConnectionFeed } from '../../../types.ts';
import VideosRemoteFeed from './Videos/VideosRemoteFeed.vue';
import { std } from '../../../std.ts';
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

async function fetchConnection() {
    loading.value = true;

    try {
        connection.value = await std(`/api/marti/video/${route.params.connectionid}`, {
            method: 'GET'
        }) as VideoConnection;

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
            await std(`/api/marti/video/${connection.value.uuid}`, {
                method: 'PUT',
                body: connection.value
            });
        } else {
            await std('/api/marti/video', {
                method: 'POST',
                body: {
                    groups: groups.value,
                    ...connection.value
                }
            });
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
        await std(`/api/marti/video/${route.params.connectionid}`, {
            method: 'DELETE'
        });

        router.push(`/menu/videos`)
    } catch (err) {
        loading.value = false;

        throw err;
    }
}
</script>
