<template>
    <MenuTemplate
        name='Videos'
        :loading='loading'
    >
        <template #buttons>
            <TablerIconButton
                v-if='mode === "lease"'
                title='Get Lease'
                @click='lease={}'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                v-if='mode === "lease"'
                title='Refresh Leases'
                @click='fetchLeases'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-else
                title='Refresh Connections'
                @click='fetchConnections'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <div
                class='px-2 py-2 round btn-group w-100'
                role='group'
            >
                <input
                    id='connections'
                    type='radio'
                    class='btn-check'
                    autocomplete='off'
                    :checked='mode === "connections"'
                    @click='mode = "connections"'
                >
                <label
                    for='connections'
                    type='button'
                    class='btn btn-sm'
                ><IconVideo
                    v-tooltip='"Video Connections"'
                    :size='32'
                    stroke='1'
                /></label>

                <input
                    id='lease'
                    type='radio'
                    class='btn-check'
                    autocomplete='off'
                    :checked='mode === "lease"'
                    @click='mode = "lease"'
                >

                <label
                    for='lease'
                    type='button'
                    class='btn btn-sm'
                ><IconServer2
                    v-tooltip='"Video Leases"'
                    :size='32'
                    stroke='1'
                /></label>
            </div>

            <template v-if='mode === "connections"'>
                <div class='col-12'>
                    <TablerNone
                        v-if='videos.size && !connections.videoConnections.length'
                        label='Video Connections'
                        :create='false'
                    />
                    <TablerAlert
                        v-else-if='error'
                        :err='error'
                    />
                    <template v-else>
                        <div
                            v-for='connection in connections.videoConnections'
                            :key='connection.uuid'
                            class='d-flex align-items-center px-3 py-2 hover-dark cursor-pointer'
                            @click='addVideo(connection)'
                        >
                            <span class='me-1'>
                                <IconVideo
                                    :size='20'
                                    stroke='1'
                                />
                            </span>

                            <span
                                class='text-truncate'
                                style='
                                    width: calc(100% - 60px);
                                '
                                v-text='connection.alias'
                            />

                            <div class='ms-auto'>
                                <TablerDelete
                                    v-if='false'
                                    displaytype='icon'
                                    @delete='deleteConnection(connection)'
                                />
                            </div>
                        </div>
                        <Feature
                            v-for='video in videos'
                            :key='video.id'
                            :feature='video'
                            @click='$router.push(`/cot/${video.id}`)'
                        />
                    </template>
                </div>
            </template>
            <template v-else-if='mode === "lease"'>
                <TablerNone
                    v-if='leases.total === 0'
                    label='Video Leases'
                    :create='false'
                />
                <TablerAlert
                    v-else-if='error'
                    :err='error'
                />
                <div
                    v-for='l in leases.items'
                    v-else
                    :key='l.id'
                    class='col-12 py-2 px-3 d-flex align-items-center hover-dark cursor-pointer'
                    @click='lease = l'
                >
                    <div class='row g-0 w-100'>
                        <div class='d-flex align-items-center w-100'>
                            <IconVideo
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-2'
                                v-text='l.name'
                            />

                            <div class='ms-auto'>
                                <TablerDelete
                                    displaytype='icon'
                                    @delete='deleteLease(l)'
                                />
                            </div>
                        </div>
                        <div class='col-12 my-0 py-0'>
                            <span
                                v-if='expired(l.expiration)'
                                style='margin-left: 42px;'
                                class='subheader text-red'
                            >Expired Lease</span>
                            <span
                                v-else-if='l.expiration === null'
                                style='margin-left: 42px;'
                                class='subheader text-blue'
                            >Permanent</span>
                            <span
                                v-else
                                style='margin-left: 42px;'
                                class='subheader'
                                v-text='l.expiration'
                            />
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </MenuTemplate>

    <VideoLeaseModal
        v-if='lease'
        :lease='lease'
        @close='lease = false'
        @refresh='fetchLeases'
    />
</template>

<script setup lang='ts'>
import MenuTemplate from '../util/MenuTemplate.vue';
import VideoLeaseModal from './Videos/VideoLeaseModal.vue';
import Feature from '../util/Feature.vue';
import { std } from '../../../std.ts';
import COT from '../../../../src/stores/base/cot.ts'
import type { VideoLease, VideoLeaseList, VideoConnectionList, VideoConnection } from '../../../types.ts';
import { useCOTStore } from '../../../stores/cots.ts';
import { useVideoStore } from '../../../stores/videos.ts';
import {
    TablerNone,
    TablerAlert,
    TablerDelete,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconVideo,
    IconRefresh,
    IconServer2,
} from '@tabler/icons-vue';

import { ref, computed, onMounted } from 'vue'

const cotStore = useCOTStore();
const videoStore = useVideoStore();

const mode = ref('connections');
const error = ref<Error | undefined>();
const loading = ref(true);
const lease = ref();
const leases = ref<VideoLeaseList>({ total: 0, items: [] });
const connections = ref<VideoConnectionList>({ videoConnections: [] });

onMounted(async () => {
    await fetchConnections();
    await fetchLeases();
});

const videos = computed(() => {
    return cotStore.filter((cot: COT) => {
        return !!(cot.properties && cot.properties.video);
    }, {
        mission: true
    })
});

const addVideo = videoStore.addConnection;

function expired(expiration: string | null): boolean {
    if (!expiration) return false;
    return +new Date(expiration) < +new Date();
}

async function fetchLeases(): Promise<void> {
    try {
        lease.value = undefined;
        loading.value = true;
        error.value = undefined;
        leases.value = await std('/api/video/lease') as VideoLeaseList
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

async function fetchConnections(): Promise<void> {
    try {
        lease.value = undefined;
        loading.value = true;
        error.value = undefined;
        connections.value = await std('/api/marti/video') as VideoConnectionList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

async function deleteLease(lease: VideoLease): Promise<void> {
    loading.value = true;

    try {
        await std(`/api/video/lease/${lease.id}`, {
            method: 'DELETE'
        });

        await fetchLeases();
    } catch (err) {
        loading.value = false;

        throw err;
    }
}

async function deleteConnection(connection: VideoConnection): Promise<void> {
    loading.value = true;

    try {
        await std(`/api/marti/video/${connection.uuid}`, {
            method: 'DELETE'
        });

        await fetchConnections();
    } catch (err) {
        loading.value = false;

        throw err;
    }
}
</script>
