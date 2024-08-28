<template>
    <TablerModal :size='editLease.id ? "xl" : undefined'>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("refresh")'
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
                <IconRefresh
                    v-if='editLease.id'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetchLease'
                />
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
                    <img height='600px' width='600px' alt='UAS Tool Wizard Image' :src='`/wizard/Step${wizard}.png`' class='rounded'>

                    <div v-if='wizard === 8'>
                        <div class='subheader pt-4'>RTSP Path</div>
                        <CopyField :text='protocols.rtsp.url.replace(/.*\//, "")'/>
                    </div>
                </div>
            </div>

            <div class='modal-footer'>
                <div class='d-flex align-items-center w-100'>
                    <button
                        class='btn btn-secondary'
                        @click='wizard = wizard -= 1'
                    >
                        <IconChevronLeft :size='20' :stroke='1'/>
                        <span v-if='wizard === 1' class='mx-2'>Close</span>
                        <span v-else class='mx-2'>Back</span>
                    </button>

                    <div class='ms-auto'>
                        <button
                            class='btn btn-primary'
                            @click='wizard = wizard > 10 ? 0 : wizard + 1'
                        >
                            <span v-if='wizard < 10' class='mx-2'>Next</span>
                            <span v-else class='mx-2'>Done</span>
                            <IconChevronRight :size='20' :stroke='1'/>
                        </button>
                    </div>
                </div>
            </div>
        </template>
        <template v-else>
            <div
                class='modal-body row'
            >
                <div
                    class='col-12'
                >
                    <TablerInput
                        v-model='editLease.name'
                        label='Lease Name'
                    />

                    <TablerEnum
                        v-if='!editLease.id'
                        v-model='editLease.duration'
                        :options='["16 Hours", "12 Hours", "6 Hours", "1 Hour"]'
                        label='Lease Duration'
                    />

                    <label
                        class='subheader mt-3 cursor-pointer'
                        @click='advanced = !advanced'
                    >
                        <IconSquareChevronRight
                            v-if='!advanced'
                            :size='32'
                            :stroke='1'
                        />
                        <IconChevronDown
                            v-else
                            :size='32'
                            :stroke='1'
                        />
                        Advanced Options
                    </label>

                    <div
                        v-if='advanced'
                        class='col-12'
                    >
                        <TablerInput
                            v-model='editLease.stream_user'
                            :disabled='editLease.id'
                            label='Stream Username'
                        />

                        <TablerInput
                            v-model='editLease.stream_pass'
                            :disabled='editLease.id'
                            label='Stream Password'
                        />
                    </div>

                    <template v-if='Object.keys(protocols).length'>
                        <div class='subheader pt-4'>
                            Video Streaming Protocols
                        </div>
                        <div
                            v-for='protocol in protocols'
                            class='pt-2'
                        >
                            <div v-text='protocol.name' />
                            <CopyField :text='protocol.url' />
                        </div>
                    </template>
                </div>
            </div>
            <div class='modal-footer'>
                <button
                    v-if='protocols.rtsp'
                    class='btn btn-secondary'
                    @click='wizard = 1'
                >
                    <IconWand :size='20' :stroke='1'/>
                    <span class='mx-2'>UAS Tool Wizard</span>
                </button>
                <button
                    class='btn btn-primary'
                    @click='saveLease'
                >
                    Save
                </button>
            </div>
        </template>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import CopyField from '../../util/CopyField.vue';
import {
    IconRefresh,
    IconWand,
    IconSquareChevronRight,
    IconChevronRight,
    IconChevronLeft,
    IconChevronDown,
} from '@tabler/icons-vue';
import {
    TablerLoading,
    TablerModal,
    TablerInput,
    TablerEnum,
    TablerDelete
} from '@tak-ps/vue-tabler'

export default {
    name: 'VideoLeaseModal',
    components: {
        CopyField,
        IconWand,
        IconRefresh,
        IconSquareChevronRight,
        IconChevronRight,
        IconChevronLeft,
        IconChevronDown,
        TablerModal,
        TablerEnum,
        TablerInput,
        TablerDelete,
        TablerLoading,
    },
    props: {
        lease: {
            type: Object,
            required: true
        }
    },
    emits: [
        'close',
        'refresh'
    ],
    data: function() {
        return {
            loading: true,
            wizard: 0,
            advanced: false,
            protocols: {},
            editLease: {
                name: '',
                duration: '16 Hours',
                stream_user: '',
                stream_pass: ''
            }
        }
    },
    mounted: async function() {
        if (this.lease.id) {
            this.editLease = this.lease;
            await this.fetchLease();
        }

        this.loading = false
    },
    methods: {
        fetchLease: async function() {
            this.loading = true;

            const { lease, protocols } = await std(`/api/video/lease/${this.editLease.id}`, {
                method: 'GET',
            });

            this.editLease = lease;
            this.protocols = protocols;

            this.loading = false;
        },
        deleteLease: async function() {
            await std(`/api/video/lease/${this.lease.id}`, {
                method: 'DELETE',
            });

            this.$emit('refresh');
        },
        saveLease: async function() {
            this.loading = true;

            if (this.editLease.id) {
                await std(`/api/video/lease/${this.editLease.id}`, {
                    method: 'PATCH',
                    body: this.editLease
                });
                this.$emit('refresh');
            } else {
                const lease = await std('/api/video/lease', {
                    method: 'POST',
                    body: {
                        name: this.editLease.name,
                        duration: parseInt(this.editLease.duration.split(' ')[0]) * 60 * 60
                    }
                });

                if (this.editLease.id) {
                    this.$emit('refresh')
                } else {
                    this.editLease = lease;
                    await this.fetchLease();
                }

                this.loading = false;
            }
        },
    }
}
</script>
