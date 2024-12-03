<template>
    <TablerModal :size='editLease.id ? "xl" : undefined'>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("refresh")'
        />
        <div class='modal-header'>
            <div
                v-if='wizard > 0'
                v-text='`Configuration Wizard Step #${wizard}`'
            />
            <div
                v-else
                class='modal-title'
                v-text='editLease.id ? "Edit Lease" : "New Lease"'
            />

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    v-if='editLease.id'
                    title='Refresh'
                    @click='fetchLease'
                >
                    <IconRefresh
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerDelete
                    v-if='editLease.id'
                    displaytype='icon'
                    @delete='deleteLease'
                />
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <template v-else-if='wizard > 0'>
            <div class='d-flex align-items-center w-100 justify-content-center'>
                <div class='py-2'>
                    <img
                        height='600px'
                        width='600px'
                        alt='UAS Tool Wizard Image'
                        :src='`/wizard/Step${wizard}.png`'
                        class='rounded'
                    >

                    <div v-if='wizard === 8'>
                        <div class='subheader pt-4'>
                            RTSP Path
                        </div>
                        <CopyField
                            v-if='protocols.rtsp'
                            :model-value='protocols.rtsp.url.replace(/.*\//, "")'
                        />
                    </div>
                </div>
            </div>

            <div class='modal-footer'>
                <div class='d-flex align-items-center w-100'>
                    <button
                        class='btn btn-secondary'
                        @click='wizard = wizard -= 1'
                    >
                        <IconChevronLeft
                            :size='20'
                            stroke='1'
                        />
                        <span
                            v-if='wizard === 1'
                            class='mx-2'
                        >Close</span>
                        <span
                            v-else
                            class='mx-2'
                        >Back</span>
                    </button>

                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='wizard = wizard > 10 ? 0 : wizard + 1'
                        >
                            <span
                                v-if='wizard < 10'
                                class='mx-2'
                            >Next</span>
                            <span
                                v-else
                                class='mx-2'
                            >Done</span>
                            <IconChevronRight
                                :size='20'
                                stroke='1'
                            />
                        </button>
                    </div>
                </div>
            </div>
        </template>
        <template v-else>
            <div
                class='modal-body row g-2'
            >
                <div class='col-12'>
                    <TablerInput
                        v-model='editLease.name'
                        label='Lease Name'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-if='!editLease.id'
                        v-model='editLease.duration'
                        :options='durations'
                        label='Lease Duration'
                    />
                </div>
                <div class='col-12'>
                    <TablerToggle
                        v-model='shared'
                        label='Shared Lease'
                    />
                </div>
                <div class='col-12'>
                    <label
                        class='subheader mt-3 cursor-pointer'
                        @click='advanced = !advanced'
                    >
                        <IconSquareChevronRight
                            v-if='!advanced'
                            :size='32'
                            stroke='1'
                        />
                        <IconChevronDown
                            v-else
                            :size='32'
                            stroke='1'
                        />
                        Advanced Options
                    </label>

                    <div
                        v-if='advanced'
                        class='col-12'
                    >
                        <!-- NOT SUPPORTED IN iTAK-->
                        <TablerInput
                            v-model='editLease.stream_user'
                            :disabled='true'
                            label='Stream Username'
                        />

                        <TablerInput
                            v-model='editLease.stream_pass'
                            :disabled='true'
                            label='Stream Password'
                        />
                    </div>

                    <template v-if='Object.keys(protocols).length'>
                        <div class='subheader pt-4'>
                            Video Streaming Protocols
                        </div>
                        <template v-if='expired(editLease.expiration)'>
                            <TablerAlert
                                title='Expired Lease'
                                :err='new Error("Renew the lease to continue using the video stream")'
                                :advanced='false'
                            />

                            <div class='col-12 d-flex justify-content-center pb-3'>
                                <TablerEnum
                                    v-model='editLease.duration'
                                    :options='durations'
                                    style='width: 300px;'
                                />
                            </div>
                            <div class='col-12 d-flex justify-content-center'>
                                <button
                                    class='btn btn-primary'
                                    style='width: 280px'
                                    @click='saveLease(false)'
                                >
                                    Renew Lease
                                </button>
                            </div>
                        </template>
                        <template v-else>
                            <div
                                v-for='protocol in protocols'
                                class='pt-2'
                            >
                                <template v-if='protocol'>
                                    <div v-text='protocol.name' />
                                    <CopyField v-model='protocol.url' />
                                </template>
                            </div>
                        </template>
                    </template>
                </div>
            </div>
            <div class='modal-footer'>
                <button
                    v-if='protocols.rtsp && !expired(editLease.expiration)'
                    class='btn btn-secondary'
                    @click='wizard = 1'
                >
                    <IconWand
                        :size='20'
                        stroke='1'
                    />
                    <span class='mx-2'>UAS Tool Wizard</span>
                </button>
                <button
                    class='btn btn-primary'
                    @click='saveLease(true)'
                >
                    Save
                </button>
            </div>
        </template>
    </TablerModal>
</template>

<script setup lang='ts'>
import { std } from '../../../../std.ts';
import CopyField from '../../util/CopyField.vue';
import { ref, onMounted } from 'vue';
import type { VideoLease, VideoLeaseResponse, VideoLeaseProtocols } from '../../../../types.ts';
import { useProfileStore } from '../../../../stores/profile.ts';
import {
    IconRefresh,
    IconWand,
    IconSquareChevronRight,
    IconChevronRight,
    IconChevronLeft,
    IconChevronDown,
} from '@tabler/icons-vue';
import {
    TablerIconButton,
    TablerLoading,
    TablerToggle,
    TablerAlert,
    TablerModal,
    TablerInput,
    TablerEnum,
    TablerDelete
} from '@tak-ps/vue-tabler'

const props = defineProps<{
    lease: VideoLease
}>();

const emit = defineEmits([ 'close', 'refresh' ])

const loading = ref(true);
const wizard = ref(0);
const advanced = ref(false);
const protocols = ref<VideoLeaseProtocols>({});

const profileStore = useProfileStore();

const durations = ref<Array<string>>(["16 Hours", "12 Hours", "6 Hours", "1 Hour"]);

if (profileStore.profile && profileStore.profile.system_admin) {
    durations.value.push('Permanent');
}

const shared = ref(false);

const editLease = ref<{
    id?: number
    name: string
    duration: string
    expiration?: string | null
    stream_user: string | null
    stream_pass: string | null
}>({
    name: '',
    duration: '16 Hours',
    stream_user: '',
    stream_pass: ''
});

onMounted(async () => {
    if (props.lease.id) {
        editLease.value = {
            ...props.lease,
            duration: '16 Hours'
        }
        await fetchLease();
    }

    loading.value = false
});

function expired(expiration?: string | null) {
    if (!expiration) return false;
    return +new Date(expiration) < +new Date();
}

async function fetchLease() {
    loading.value = true;

    const res = await std(`/api/video/lease/${editLease.value.id}`, {
        method: 'GET',
    }) as VideoLeaseResponse;

    editLease.value = {
        ...res.lease,
        duration: '16 Hours'
    }

    if (res.channel) {
        shared.value = true;
    } else {
        shared.value = false;
    }

    protocols.value = res.protocols;

    loading.value = false;
}

async function deleteLease() {
    try {
        loading.value = true;

        await std(`/api/video/lease/${props.lease.id}`, {
            method: 'DELETE',
        });

        loading.value = false;

         emit('refresh');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function saveLease(close: boolean) {
    try {
        loading.value = true;

        if (editLease.value.id) {
            const res = await std(`/api/video/lease/${editLease.value.id}`, {
                method: 'PATCH',
                body: {
                    ...editLease.value,
                    duration: editLease.value.duration === 'Permanent' ? undefined : parseInt(editLease.value.duration.split(' ')[0]) * 60 * 60,
                    permanent: editLease.value.duration === 'Permanent' ? true : false
                }
            }) as VideoLeaseResponse;

            if (close) {
                emit('refresh');
            } else {
                editLease.value = {
                    ...res.lease,
                    duration: '16 Hours'
                }

                protocols.value = res.protocols;
            }

            loading.value = false;
        } else {
            const res = await std('/api/video/lease', {
                method: 'POST',
                body: {
                    name: editLease.value.name,
                    duration: editLease.value.duration === 'Permanent' ? undefined : parseInt(editLease.value.duration.split(' ')[0]) * 60 * 60,
                    permanent: editLease.value.duration === 'Permanent' ? true : false
                }
            }) as VideoLeaseResponse;

            if (editLease.value.id && close) {
                emit('refresh');
            } else {
                editLease.value = {
                    ...res.lease,
                    duration: '16 Hours'
                }

                protocols.value = res.protocols;
            }

            loading.value = false;
        }
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
