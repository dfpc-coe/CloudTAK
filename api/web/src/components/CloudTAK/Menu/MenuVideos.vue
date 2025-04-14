<template>
    <MenuTemplate
        name='Videos'
        :loading='loading.main'
    >
        <template #buttons>
            <template v-if='mode === "lease"'>
                <TablerIconButton
                    title='Get Lease'
                    @click='lease={}'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    title='Refresh Leases'
                    @click='fetchLeases'
                >
                    <IconRefresh
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </template>
            <template v-else>
                <TablerIconButton
                    title='Publish Video Stream'
                    @click='$router.push(`/menu/videos/remote/new`)'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    title='Refresh Connections'
                    @click='fetchConnections'
                >
                    <IconRefresh
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
            </template>
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
                    <TablerLoading
                        v-if='loading.connections'
                    />
                    <TablerNone
                        v-else-if='!videos.size && !connections.videoConnections.length'
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
                            @click='videoStore.addConnection(connection)'
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
                                    width: calc(100% - 100px);
                                '
                                v-text='connection.alias'
                            />

                            <div class='ms-auto btn-list'>
                                <TablerIconButton
                                    title='Edit Lease'
                                    @click.stop='$router.push(`/menu/videos/remote/${connection.uuid}`)'
                                >
                                    <IconPencil
                                        :size='24'
                                        stroke='1'
                                    />
                                </TablerIconButton>
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
                <div class='col-12 px-2'>
                    <TablerInput
                        v-model='leasePaging.filter'
                        icon='search'
                        placeholder='Lease Search'
                    />
                </div>
                <TablerLoading
                    v-if='loading.leases'
                />
                <TablerNone
                    v-else-if='leases.total === 0'
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
                            <VideoLeaseSourceType :source-type='l.source_type' />
                        
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
                <div class='col-12 d-flex justify-content-center pt-3'>
                    <TablerPager
                        v-if='leases.total > leasePaging.limit'
                        :page='leasePaging.page'
                        :total='leases.total'
                        :limit='leasePaging.limit'
                        @page='leasePaging.page = $event'
                    />
                </div>
            </template>
        </template>
    </MenuTemplate>

    <VideoLeaseModal
        v-if='lease'
        :lease='lease'
        :is-system-admin='isSystemAdmin'
        @close='lease = false'
        @refresh='fetchLeases'
    />
</template>

<script setup lang='ts'>
import MenuTemplate from '../util/MenuTemplate.vue';
import VideoLeaseModal from './Videos/VideoLeaseModal.vue';
import Feature from '../util/Feature.vue';
import { std, stdurl } from '../../../std.ts';
import COT from '../../../base/cot.ts';
import VideoLeaseSourceType from '../util/VideoLeaseSourceType.vue';
import type { VideoLease, VideoLeaseList, VideoConnectionList } from '../../../types.ts';
import { useMapStore } from '../../../stores/map.ts';
import { useVideoStore } from '../../../stores/videos.ts';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerPager,
    TablerDelete,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconVideo,
    IconPencil,
    IconRefresh,
    IconServer2,
} from '@tabler/icons-vue';

import { ref, watch, onMounted } from 'vue'

const mapStore = useMapStore();
const videoStore = useVideoStore();

const leasePaging = ref({
    page: 0,
    filter: '',
    limit: 20
})

const mode = ref('connections');
const error = ref<Error | undefined>();
const loading = ref({
    main: true,
    connections: true,
    leases: true
});
const lease = ref();
const isSystemAdmin = ref(false);
const leases = ref<VideoLeaseList>({ total: 0, items: [] });
const connections = ref<VideoConnectionList>({ videoConnections: [] });
const videos = ref<Set<COT>>(new Set())

watch(leasePaging.value, async () => {
    await fetchLeases();
});

onMounted(async () => {
    if (await mapStore.worker.profile.isSystemAdmin()) {
        isSystemAdmin.value = true;
    }

    await fetchConnections();
    await fetchLeases();

    videos.value = await mapStore.worker.db.filter('properties.video', {
        mission: true
    })

    loading.value.main = false;
});

function expired(expiration: string | null): boolean {
    if (!expiration) return false;
    return +new Date(expiration) < +new Date();
}

async function fetchLeases(): Promise<void> {
    try {
        lease.value = undefined;
        loading.value.leases = true;
        error.value = undefined;
        const url = stdurl('/api/video/lease');
        url.searchParams.append('filter', leasePaging.value.filter);
        url.searchParams.append('expired', 'all');
        url.searchParams.append('limit', String(leasePaging.value.limit));
        url.searchParams.append('page', String(leasePaging.value.page));
        leases.value = await std(url) as VideoLeaseList
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.leases = false;
}

async function fetchConnections(): Promise<void> {
    try {
        lease.value = undefined;
        loading.value.connections = true;
        error.value = undefined;
        connections.value = await std('/api/marti/video') as VideoConnectionList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value.connections = false;
}

async function deleteLease(lease: VideoLease): Promise<void> {
    loading.value.main = true;

    try {
        await std(`/api/video/lease/${lease.id}`, {
            method: 'DELETE'
        });

        await fetchLeases();
    } catch (err) {
        loading.value.main = false;
        throw err;
    }
}

</script>
