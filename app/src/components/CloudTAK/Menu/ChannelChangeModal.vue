<template>
    <TablerModal>
        <div class='modal-status bg-yellow' />
        <div class='modal-body text-center py-4'>
            <IconList
                :size='68'
                class='text-yellow mb-2'
                stroke='1'
            />
            <h3>Channel List Changed</h3>
            <div class='text-secondary'>
                Your available channel list has been updated by the server.
                Would you like to review and update your channel/group assignments?
            </div>
        </div>
        <div class='modal-footer'>
            <div class='w-100'>
                <div class='row'>
                    <div class='col'>
                        <button
                            class='btn w-100'
                            @click='dismiss'
                        >
                            Dismiss
                        </button>
                    </div>
                    <div class='col'>
                        <button
                            class='btn btn-warning w-100'
                            @click='updateChannels'
                        >
                            Update Channels
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang="ts">
import { TablerModal } from '@tak-ps/vue-tabler';
import { IconList } from '@tabler/icons-vue';
import { useRouter } from 'vue-router';

const emit = defineEmits(['close']);
const router = useRouter();

function dismiss() {
    emit('close');
}

function updateChannels() {
    emit('close');
    router.push('/menu/channels');
}
</script>
