<template>
    <MenuTemplate
        name='Videos'
        :loading='loading.main'
    >
        <template #buttons>
            <TablerIconButton
                title='Publish Video Stream'
                @click='router.push(`/menu/videos/remote/new`)'
            >
                <IconVideoPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerIconButton
                title='Get Lease'
                @click='lease={}'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <template v-if='mode === "lease"'>
                <TablerRefreshButton
                    :loading='loading.main'
                    @click='fetchLeases'
                />
            </template>
            <template v-else>
                <TablerRefreshButton
                    :loading='loading.main'
                    @click='fetchConnections'
                />
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
                /><span class='ms-2'>Streams</span></label>

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
                /><span class='ms-2'>Leases</span></label>
            </div>

            <template v-if='mode === "connections"'>
                <div class='col-12'>
                    <EmptyInfo v-if='mapStore.hasNoChannels' />

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
                    <div
                        v-else
                        class='col-12 d-flex flex-column gap-2'
                    >
                        <StandardItem
                            v-for='connection in connections.videoConnections'
                            :key='connection.uuid'
                            class='d-flex align-items-center gap-3 p-2'
                            @click='floatStore.addConnection(connection)'
                        >
                            <div
                                class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                                style='width: 3rem; height: 3rem; min-width: 3rem;'
                            >
                                <IconVideo
                                    :size='24'
                                    stroke='1'
                                />
                            </div>

                            <div class='d-flex flex-column'>
                                <div class='fw-bold'>
                                    <span v-if='connection.alias'>{{ connection.alias }}</span>
                                    <span
                                        v-else
                                        class='fst-italic text-secondary'
                                    >Unnamed</span>
                                </div>
                            </div>

                            <div class='d-flex btn-list ms-auto'>
                                <TablerIconButton
                                    title='Edit Lease'
                                    @click.stop='router.push(`/menu/videos/remote/${connection.uuid}`)'
                                >
                                    <IconPencil
                                        :size='24'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </StandardItem>
                        <StandardItem
                            v-for='video in videos'
                            :key='video.id'
                            class='d-flex align-items-center gap-3 p-2 cursor-pointer'
                            @click='router.push(`/cot/${video.id}`)'
                        >
                            <div
                                class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                                style='width: 3rem; height: 3rem; min-width: 3rem;'
                            >
                                <IconVideo
                                    :size='24'
                                    stroke='1'
                                />
                            </div>

                            <div class='d-flex flex-column'>
                                <div class='fw-bold'>
                                    <span v-if='video.properties.callsign || video.properties.name'>{{ video.properties.callsign || video.properties.name }}</span>
                                    <span
                                        v-else
                                        class='fst-italic text-secondary'
                                    >Unnamed</span>
                                </div>
                            </div>
                        </StandardItem>
                    </div>
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
                    v-else
                    class='col-12 d-flex flex-column gap-2 p-3'
                >
                    <StandardItem
                        v-for='l in leases.items'
                        :key='l.id'
                        class='d-flex align-items-center gap-3 p-2 cursor-pointer'
                        @click='lease = l'
                    >
                        <div
                            class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25'
                            style='width: 3rem; height: 3rem; min-width: 3rem;'
                        >
                            <component
                                :is='getLeaseIcon(l.source_type)'
                                :size='24'
                                stroke='1'
                            />
                        </div>

                        <div class='d-flex flex-column'>
                            <div class='fw-bold'>
                                <span v-if='l.name'>{{ l.name }}</span>
                                <span
                                    v-else
                                    class='fst-italic text-secondary'
                                >Unnamed</span>
                            </div>
                            <div
                                v-if='getLeaseDescription(l)'
                                class='text-secondary small'
                                :class='getLeaseDescriptionClass(l)'
                            >
                                {{ getLeaseDescription(l) }}
                            </div>
                        </div>

                        <div class='d-flex btn-list ms-auto'>
                            <TablerDelete
                                displaytype='icon'
                                @delete='deleteLease(l)'
                            />
                        </div>
                    </StandardItem>
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
import EmptyInfo from '../util/EmptyInfo.vue';
import StandardItem from '../util/StandardItem.vue';
import { std, server } from '../../../std.ts';
import COT from '../../../base/cot.ts';
import type { VideoLease, VideoLeaseList, VideoConnectionList } from '../../../types.ts';

import { useMapStore } from '../../../stores/map.ts';
import { useFloatStore } from '../../../stores/float.ts';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerPager,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconVideo,
    IconPencil,
    IconServer2,
    IconVideoPlus,
    IconCar,
    IconWalk,
    IconDrone,
    IconHelicopter,
    IconPlane,
    IconDeviceDesktop,
} from '@tabler/icons-vue';

import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router';

const router = useRouter();
const mapStore = useMapStore();
const floatStore = useFloatStore();

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

watch(mode, async () => {
    if (mode.value === 'connections') {
        await fetchConnections();
    } else if (mode.value === 'lease') {
        await fetchLeases();
    }
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

        const res = await server.GET('/api/video/lease', {
            params: {
                query: {
                    filter: leasePaging.value.filter,
                    expired: 'all',
                    order: 'desc',
                    sort: 'created',
                    ephemeral: 'false',
                    limit: leasePaging.value.limit,
                    page: leasePaging.value.page
                }
            }
        })

        if (res.error) throw new Error(res.error.message);

        leases.value = res.data;
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

        loading.value.main = false;
    } catch (err) {
        loading.value.main = false;
        throw err;
    }
}

function getLeaseIcon(sourceType: string) {
    switch (sourceType) {
        case 'vehicle': return IconCar;
        case 'personal': return IconWalk;
        case 'uas-rotor': return IconDrone;
        case 'rotor': return IconHelicopter;
        case 'fixedwing': return IconPlane;
        case 'uas-fixedwing': return IconPlane;
        case 'screenshare': return IconDeviceDesktop;
        default: return IconVideo;
    }
}

function getLeaseDescription(lease: VideoLease): string {
    if (expired(lease.expiration)) return 'Expired Lease';
    if (lease.expiration === null) return 'Permanent';
    return lease.expiration;
}

function getLeaseDescriptionClass(lease: VideoLease): string {
    if (expired(lease.expiration)) return 'text-red';
    if (lease.expiration === null) return 'text-blue';
    return '';
}

</script>
