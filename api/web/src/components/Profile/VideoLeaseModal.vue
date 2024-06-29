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
                    v-model='editLease.duration'
                    :options='["16 Hours", "12 Hours", "6 Hours", "1 Hour"]'
                    label='Lease Duration'
                />
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
    TablerModal,
    TablerInput,
    TablerEnum,
    TablerDelete
} from '@tak-ps/vue-tabler'

export default {
    name: 'VideoLeaseModal',
    components: {
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
        if (this.lease.id) {
            return {
                code: false,
                editLease: JSON.parse(JSON.stringify(this.lease))
            }
        } else {
            return {
                code: false,
                editLease: {
                    name: '',
                    duration: '16 Hours'
                }
            }

        }
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
                const newlease = await std('/api/video/lease', {
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
