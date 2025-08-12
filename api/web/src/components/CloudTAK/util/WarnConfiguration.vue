<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-red' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-white'>
            <div class='d-flex align-items-center'>
                <IconInfoSquare
                    :size='28'
                    stroke='1'
                />
                <span class='mx-2'>Welcome to CloudTAK</span>
            </div>
        </div>
        <div class='modal-body text-white'>
            <SettingsCallsign
                mode='emit'
                :force-callsign='true'
                @update='emit("close")'
            />
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import {
    TablerModal,
} from '@tak-ps/vue-tabler';
import {
    IconInfoSquare,
} from '@tabler/icons-vue';

import SettingsCallsign from './SettingsCallsign.vue';

const emit = defineEmits([ 'close' ]);
</script>
