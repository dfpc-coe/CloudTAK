<template>
    <TablerModal size='xl'>
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
                    v-if='disabled && editLease.id'
                    title='Refresh'
                    @click='fetchLease'
                >
                    <IconRefresh
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    v-if='disabled && editLease.id'
                    title='Edit'
                    @click='disabled = false'
                >
                    <IconPencil
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
                        description='The human readable name of the Lease'
                        :disabled='disabled'
                        label='Lease Name'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-if='!editLease.id'
                        v-model='editLease.duration'
                        :options='durations'
                        :disabled='disabled'
                        label='Lease Duration'
                    />
                </div>
                <div class='col-12'>
                    <TablerToggle
                        v-model='shared'
                        description='By default only the user that created a Lease can manage it. If you are operating as part of an agency, turn on Lease Sharing to allow all users in your Channel to manage the lease'
                        :disabled='disabled'
                        label='Shared Lease'
                    />
                </div>
                <div
                    v-if='shared'
                    class='col-12'
                >
                    <GroupSelect
                        v-if='!disabled'
                        v-model='channels'
                        :limit='1'
                    />
                    <div
                        v-else
                        class='border border-white rounded px-2 py-2'
                    >
                        <IconAffiliate
                            :size='24'
                            stroke='1'
                        /> <span v-text='editLease.channel' />
                    </div>
                </div>

                <div class='col-12'>
                    <label>Lease Expiration</label>

                    <div class='col-12'>
                        <span
                            v-if='expired(editLease.expiration)'
                            class='badge bg-red text-white mt-2'
                        >Expired</span>
                        <span
                            v-else-if='editLease.expiration === null'
                            class='badge bg-blue text-white mt-2'
                        >Permanent</span>
                        <CopyField
                            v-else-if='editLease.expiration'
                            :model-value='editLease.expiration'
                        />
                    </div>
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
                        class='col-12 row'
                    >
                        <div
                            class='alert alert-info'
                            role='alert'
                        >
                            <div class='d-flex'>
                                <div class='me-2'>
                                    <IconInfoCircle
                                        :size='32'
                                        stroke='1'
                                    />
                                </div>
                                <div>
                                    <h4 class='alert-title'>
                                        Stream Username & Password Disabled
                                    </h4>
                                    <div class='text-secondary'>
                                        iTAK Does not currently support in URL username/passwords so this option is currently disabled
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- NOT SUPPORTED IN iTAK-->
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='editLease.stream_user'
                                :disabled='true'
                                label='Stream Username'
                            />
                        </div>
                        <div class='col-md-6'>
                            <TablerInput
                                v-model='editLease.stream_pass'
                                :disabled='true'
                                label='Stream Password'
                            />
                        </div>
                    </div>
                </div>

                <template v-if='disabled && Object.keys(protocols).length'>
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
                                @click='saveLease'
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
                    v-if='!disabled'
                    class='btn btn-primary'
                    @click='saveLease'
                >
                    Save
                </button>
                <button
                    v-if='disabled'
                    class='btn btn-primary'
                    @click='emit("close")'
                >
                    Done
                </button>
            </div>
        </template>
    </TablerModal>
</template>

<script setup lang='ts'>
import { std } from '../../../../std.ts';
import CopyField from '../../util/CopyField.vue';
import { ref, watch, onMounted } from 'vue';
import type { VideoLease, VideoLeaseResponse, VideoLeaseProtocols } from '../../../../types.ts';
import GroupSelect from '../../../util/GroupSelect.vue';
import { useProfileStore } from '../../../../stores/profile.ts';
import {
    IconRefresh,
    IconPencil,
    IconWand,
    IconAffiliate,
    IconInfoCircle,
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
const disabled = ref(true);
const wizard = ref(0);
const advanced = ref(false);
const protocols = ref<VideoLeaseProtocols>({});

const channels = ref<string[]>([]);

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
    channel: string | null
    expiration?: string | null
    stream_user: string | null
    stream_pass: string | null
}>({
    name: '',
    duration: '16 Hours',
    channel: null,
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
    } else {
        disabled.value = false;
    }

    loading.value = false
});

watch(shared, () => {
    if (!shared.value) {
        channels.value = [];
    }
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

    if (editLease.value.channel) {
        channels.value = [ editLease.value.channel ];
    } else {
        channels.value = [];
    }

    if (res.lease.channel) {
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

        await std(`/api/video/lease/${editLease.value.id}`, {
            method: 'DELETE',
        });

        loading.value = false;

         emit('refresh');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function saveLease() {
    try {
        loading.value = true;

        if (editLease.value.id) {
            const res = await std(`/api/video/lease/${editLease.value.id}`, {
                method: 'PATCH',
                body: {
                    name: editLease.value.name,
                    channel: channels.value.length ? channels.value[0] : null,
                    duration: editLease.value.duration === 'Permanent' ? undefined : parseInt(editLease.value.duration.split(' ')[0]) * 60 * 60,
                    permanent: editLease.value.duration === 'Permanent' ? true : false
                }
            }) as VideoLeaseResponse;

            editLease.value = {
                ...res.lease,
                duration: '16 Hours'
            }

            protocols.value = res.protocols;
            disabled.value = true;
            loading.value = false;
        } else {
            const res = await std('/api/video/lease', {
                method: 'POST',
                body: {
                    name: editLease.value.name,
                    channel: channels.value.length ? channels.value[0] : null,
                    duration: editLease.value.duration === 'Permanent' ? undefined : parseInt(editLease.value.duration.split(' ')[0]) * 60 * 60,
                    permanent: editLease.value.duration === 'Permanent' ? true : false
                }
            }) as VideoLeaseResponse;

            editLease.value = {
                ...res.lease,
                duration: '16 Hours'
            }

            protocols.value = res.protocols;
            disabled.value = true;
            loading.value = false;
        }
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
