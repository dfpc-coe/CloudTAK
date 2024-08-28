<template>
    <TablerModal :size='editLease.id ? "xl" : undefined'>
        <div class='modal-status bg-yellow' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-header'>
            <div
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
        <div
            v-else
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
                class='btn btn-primary'
                @click='saveLease'
            >
                Save
            </button>
        </div>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import CopyField from '../../util/CopyField.vue';
import {
    IconRefresh,
    IconSquareChevronRight,
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
        IconRefresh,
        IconSquareChevronRight,
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
