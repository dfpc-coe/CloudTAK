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
                v-else-if='disabled'
                class='d-flex align-items-center'
            >
                <VideoLeaseSourceType :source-type='editLease.source_type' />
                <div class='row mx-2'>
                    <span
                        class='modal-title'
                        v-text='editLease.name'
                    />
                    <span
                        v-if='editLease.source_model'
                        class='subheader'
                        v-text='editLease.source_model'
                    />
                </div>
            </div>
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
        <template v-else-if='disabled'>
            <div class='modal-body'>
                <template v-if='Object.keys(protocols).length'>
                    <div class='col-12 d-flex align-items-center pt-4'>
                        <div class='subheader'>
                            Video Streaming Protocols
                        </div>

                        <div class='ms-auto'>
                            <div v-if='!secure'>
                                <IconArrowsLeftRight
                                    v-tooltip='"Read/Write User"'
                                    :size='32'
                                    stroke='1'
                                />
                                <span class='ms-2 user-select-none'>Read-Write User</span>
                            </div>
                            <div
                                v-else
                                class='px-2 py-2 round btn-group w-100'
                                role='group'
                            >
                                <input
                                    id='read-user'
                                    type='radio'
                                    class='btn-check'
                                    autocomplete='off'
                                    :checked='mode === "read"'
                                    @click='mode = "read"'
                                >
                                <label
                                    for='read-user'
                                    type='button'
                                    class='btn btn-sm'
                                >
                                    <IconBook2
                                        v-tooltip='"Read User"'
                                        :size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Read User</span>
                                </label>

                                <input
                                    id='publish-user'
                                    type='radio'
                                    class='btn-check'
                                    autocomplete='off'
                                    :checked='mode === "publish"'
                                    @click='mode = "publish"'
                                >
                                <label
                                    for='publish-user'
                                    type='button'
                                    class='btn btn-sm'
                                >
                                    <IconPencil
                                        v-tooltip='"Write User"'
                                        :size='32'
                                        stroke='1'
                                    />
                                    <span class='mx-2'>Write User</span>
                                </label>
                            </div>
                        </div>
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
                        <template v-if='secure && mode === "publish"'>
                            <div class='col-md-6'>
                                <CopyField
                                    label='Write Username'
                                    :model-value='editLease.stream_user || ""'
                                />
                            </div>
                            <div class='col-md-6'>
                                <CopyField
                                    label='Write Password'
                                    :model-value='editLease.stream_pass || ""'
                                />
                            </div>
                        </template>
                        <template v-else-if='secure && mode === "read"'>
                            <div class='col-md-6'>
                                <CopyField
                                    label='Read Username'
                                    :model-value='editLease.read_user || ""'
                                />
                            </div>
                            <div class='col-md-6'>
                                <CopyField
                                    label='Read Password'
                                    :model-value='editLease.read_pass || ""'
                                />
                            </div>
                        </template>
                        <div
                            v-for='protocol in protocols'
                            class='pt-2'
                        >
                            <template v-if='protocol'>
                                <CopyField
                                    v-if='secure && mode === "read"'
                                    :label='protocol.name'
                                    :model-value='protocol.url.replace("{{mode}}", mode).replace("{{username}}", editLease.read_user || "").replace("{{password}}", editLease.read_pass || "")'
                                />
                                <CopyField
                                    v-else-if='secure && mode === "publish"'
                                    :label='protocol.name'
                                    :model-value='protocol.url.replace("{{mode}}", mode).replace("{{username}}", editLease.stream_user || "").replace("{{password}}", editLease.stream_pass || "")'
                                />
                                <CopyField
                                    v-else
                                    :label='protocol.name'
                                    :model-value='protocol.url.replace("{{mode}}", mode)'
                                />
                            </template>
                        </div>
                    </template>
                </template>
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
                        label='Name'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerEnum
                        v-model='editLease.source_type'
                        default='unknown'
                        :options='[
                            "unknown",
                            "fixed",
                            "vehicle",
                            "screenshare",
                            "personal",
                            "rotor",
                            "fixedwing",
                            "uas-rotor",
                            "uas-fixedwing"
                        ]'
                        :disabled='disabled'
                        label='Source Type'
                        description='The type of sensor that is broadcasting'
                    />
                </div>
                <div class='col-12 col-md-6'>
                    <TablerInput
                        v-model='editLease.source_model'
                        :disabled='disabled'
                        label='Source Model'
                        description='Model Information about the sensor or source'
                    />
                </div>
                <div class='col-12'>
                    <TablerEnum
                        v-if='!editLease.id'
                        v-model='editLease.duration'
                        :options='durations'
                        :disabled='disabled'
                        label='Duration'
                        description='Leases remain active on the server for the duration specified. Once the lease expires the lease can be renewed without the Lease URL changing'
                    />
                </div>
                <div class='col-12'>
                    <TablerToggle
                        v-model='secure'
                        label='Read/Write Security'
                        :disabled='disabled'
                        description='Create a seperate Read/Write user to ensure unauthorized users cannot publish to a stream'
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

                <div
                    v-if='editLease.expiration !== undefined'
                    class='col-12'
                >
                    <div class='col-12 d-flex align-items-center mb-1'>
                        <label>Expiration</label>

                        <div class='ms-auto'>
                            <span
                                v-if='expired(editLease.expiration)'
                                class='badge bg-red text-white mt-2'
                            >Expired</span>
                            <span
                                v-else-if='editLease.expiration === null'
                                class='badge bg-blue text-white mt-2'
                            >Permanent</span>
                        </div>
                    </div>

                    <div class='col-12'>
                        <CopyField
                            v-if='editLease.expiration'
                            :model-value='editLease.expiration'
                        />
                    </div>
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
import { ref, watch, onMounted, withDefaults } from 'vue';
import type { VideoLease, VideoLeaseResponse, VideoLeaseProtocols } from '../../../../types.ts';
import VideoLeaseSourceType from '../../util/VideoLeaseSourceType.vue'
import GroupSelect from '../../../util/GroupSelect.vue';
import {
    IconRefresh,
    IconPencil,
    IconWand,
    IconArrowsLeftRight,
    IconBook2,
    IconAffiliate,
    IconChevronRight,
    IconChevronLeft,
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

const props = withDefaults(defineProps<{
    lease: VideoLease,
    isSystemAdmin: boolean
}>(), {
    isSystemAdmin: false
});

const emit = defineEmits([ 'close', 'refresh' ])

const mode = ref('read');
const loading = ref(true);
const secure = ref(false);
const disabled = ref(true);
const wizard = ref(0);
const protocols = ref<VideoLeaseProtocols>({});

const channels = ref<string[]>([]);

const durations = ref<Array<string>>(["16 Hours", "12 Hours", "6 Hours", "1 Hour"]);

const shared = ref(false);

const editLease = ref<{
    id?: number
    name: string
    duration: string
    channel: string | null
    source_type: string
    source_model: string
    expiration?: string | null
    stream_user: string | null
    stream_pass: string | null
    read_user: string | null
    read_pass: string | null
}>({
    name: '',
    duration: '16 Hours',
    channel: null,
    source_type: 'unknown',
    source_model: '',
    stream_user: '',
    stream_pass: '',
    read_user: '',
    read_pass: ''
});

onMounted(async () => {
    if (props.isSystemAdmin) {
        durations.value.push('Permanent');
    }

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

    if (editLease.value.stream_user && editLease.value.read_user) {
        secure.value = true;
    } else {
        secure.value = false;
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

    disabled.value = true;
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
            await std(`/api/video/lease/${editLease.value.id}`, {
                method: 'PATCH',
                body: {
                    name: editLease.value.name,
                    secure: secure.value,
                    channel: channels.value.length ? channels.value[0] : null,
                    duration: editLease.value.duration === 'Permanent' ? undefined : parseInt(editLease.value.duration.split(' ')[0]) * 60 * 60,
                    permanent: editLease.value.duration === 'Permanent' ? true : false,
                    source_type: editLease.value.source_type,
                    source_model: editLease.value.source_model,
                }
            });
        } else {
            editLease.value.id = ((await std('/api/video/lease', {
                method: 'POST',
                body: {
                    name: editLease.value.name,
                    secure: secure.value,
                    channel: channels.value.length ? channels.value[0] : null,
                    duration: editLease.value.duration === 'Permanent' ? undefined : parseInt(editLease.value.duration.split(' ')[0]) * 60 * 60,
                    permanent: editLease.value.duration === 'Permanent' ? true : false,
                    source_type: editLease.value.source_type,
                    source_model: editLease.value.source_model,
                }
            })) as VideoLeaseResponse).lease.id;
        }

        await fetchLease();
    } catch (err) {
        loading.value = false;
        throw err;
    }
}
</script>
