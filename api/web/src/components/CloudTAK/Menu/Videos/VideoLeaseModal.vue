<template>
    <TablerModal>
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
                v-text='lease.id ? "Edit Lease" : "New Lease"'
            />

            <div class='ms-auto btn-list'>
                <TablerDelete
                    v-if='editLease.id'
                    displaytype='icon'
                    @delete='deleteToken'
                />
            </div>
        </div>

        <div class='modal-body row'>
            <div
                class='col-12'
            >
                <TablerInput
                    v-model='editLease.name'
                    label='Lease Name'
                />

                <TablerEnum
                    v-if='!lease.id'
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
                        :disabled='editLease.id'
                        v-model='editLease.stream_user'
                        label='Stream Username'
                    />

                    <TablerInput
                        :disabled='editLease.id'
                        v-model='editLease.stream_pass'
                        label='Stream Password'
                    />

                </div>
            </div>
        </div>
        <div class='modal-footer'>
            <button
                v-if='!code'
                class='btn btn-primary'
                @click='saveToken'
            >
                Save
            </button>
            <button
                v-else
                class='btn btn-primary'
                @click='$emit("refresh")'
            >
                Close
            </button>
        </div>
    </TablerModal>
</template>

<script>
import { std } from '/src/std.ts';
import {
    IconSquareChevronRight,
    IconChevronDown,
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerInput,
    TablerEnum,
    TablerDelete
} from '@tak-ps/vue-tabler'

export default {
    name: 'VideoLeaseModal',
    components: {
        IconSquareChevronRight,
        IconChevronDown,
        TablerModal,
        TablerEnum,
        TablerInput,
        TablerDelete
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
        const base = {
            advanced: false
        }

        if (this.lease.id) {
            base.editLease = JSON.parse(JSON.stringify(this.lease))
        } else {
            base.editLease = {
                name: '',
                duration: '16 Hours',
                stream_user: '',
                stream_pass: ''
            };
        }

        return base;
    },
    methods: {
        deleteToken: async function() {
            await std(`/api/video/lease/${this.lease.id}`, {
                method: 'DELETE',
            });

            this.$emit('refresh');
        },
        saveToken: async function() {
            if (this.lease.id) {
                await std(`/api/video/lease/${this.lease.id}`, {
                    method: 'PATCH',
                    body: this.editLease
                });
                this.$emit('refresh');
            } else {
                await std('/api/video/lease', {
                    method: 'POST',
                    body: {
                        name: this.editLease.name,
                        duration: parseInt(this.editLease.duration.split(' ')[0]) * 60 * 60
                    }
                });

                this.$emit('refresh')
            }
        },
    }
}
</script>
