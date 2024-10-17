<template>
    <MenuTemplate
        name='Videos'
        :loading='loading'
    >
        <template #buttons>
            <TablerIconButton
                v-if='mode === "lease"'
                @click='lease={}'
                title='Get Lease'
            ><IconPlus :size='32' stroke='1'/></TablerIconButton>
            <TablerIconButton
                @click='refresh'
                title='Refresh'
            ><IconRefresh :size='32' stroke='1'/></TablerIconButton>
        </template>
        <template #default>
            <div
                class='px-2 py-2 round btn-group w-100'
                role='group'
            >
                <input
                    id='streams'
                    type='radio'
                    class='btn-check'
                    autocomplete='off'
                    :checked='mode === "streams"'
                    @click='mode = "streams"'
                >
                <label
                    for='streams'
                    type='button'
                    class='btn btn-sm'
                ><IconVideo
                    v-tooltip='"Video Streams"'
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

            <template v-if='mode === "streams"'>
                <div class='col-12'>
                    <TablerNone
                        v-if='!cotStore.videos().size'
                        label='Video Streams'
                        :create='false'
                    />
                    <template v-else>
                        <div
                            v-for='video in cotStore.videos()'
                            :key='video.id'
                            class='col-12 py-2 px-3 d-flex align-items-center hover-dark cursor-pointer'
                            @click='$router.push(`/cot/${video.id}`)'
                        >
                            <IconVideo
                                :size='32'
                                stroke='1'
                            />
                            <span
                                class='mx-2'
                                style='font-size: 18px;'
                                v-text='video.properties.callsign'
                            />
                        </div>
                    </template>
                </div>
            </template>
            <template v-else-if='mode === "lease"'>
                <TablerNone
                    v-if='leases.total === 0'
                    label='Video Leases'
                    :create='false'
                />
                <div
                    v-else
                    v-for='l in leases.items'
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
import { std } from '../../../std.ts';
import type { VideoLease, VideoLeaseList } from '../../../types.ts';
import { useCOTStore } from '../../../stores/cots.ts';
import {
    TablerNone,
    TablerDelete,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconVideo,
    IconRefresh,
    IconServer2,
} from '@tabler/icons-vue';

import { ref, onMounted } from 'vue'

const cotStore = useCOTStore();

const mode = ref('streams');
const loading = ref(true);
const lease = ref();
const leases = ref<VideoLeaseList>({ total: 0, items: [] });

onMounted(async () => {
    await fetchLeases();
});

function expired(expiration: string): boolean {
    return +new Date(expiration) < +new Date();
}

async function refresh(): Promise<void> {
    await fetchLeases();
}

async function fetchLeases(): Promise<void> {
    lease.value = undefined;
    loading.value = true;
    leases.value = await std('/api/video/lease') as VideoLeaseList
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
</script>
