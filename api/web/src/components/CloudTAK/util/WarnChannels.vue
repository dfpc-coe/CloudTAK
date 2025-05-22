<template>
    <TablerModal>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='$emit("close")'
        />
        <div class='modal-header text-white'>
            <div class='d-flex align-items-center'>
                <IconInfoSquare
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>No Channels Active</span>
            </div>
        </div>
        <div class='modal-body text-white'>
            <p>Channels are the basis of who and what you are able to see in TAK</p>

            <p>At this time you do not have any active channels and as such you will not see any Users, Data Packages, or Data Syncs associated with channels.</p>

            <p>It is recommended to turn on relevant channels now</p>

            <div class='d-flex align-items-center'>
                <div class='ms-auto btn-list'>
                    <button
                        class='btn btn-primary'
                        @click='selectChannels'
                    >
                        Select Channels
                    </button>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import {
    TablerModal,
} from '@tak-ps/vue-tabler';
import {
    IconInfoSquare,
} from '@tabler/icons-vue';

const router = useRouter();
const emit = defineEmits([ 'close' ]);

function selectChannels() {
    emit('close');
    router.push('/menu/channels');
}
</script>
