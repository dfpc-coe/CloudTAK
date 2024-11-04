<template>
    <div class='col-12 d-flex py-2 px-2 text-red justify-content-center'>
        <div class='d-flex align-items-center'>
            <IconAlertCircle
                :size='32'
                stroke='2'
                class='mx-2'
            />
            <div>
                <span v-if='type === InfoType.CHANNELS'>
                    No Channels are selected
                </span>
                <span v-else-if='type === InfoType.MISSIONS'>
                    No Data Syncs have been subscribed to
                </span>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import {
    IconAlertCircle
} from '@tabler/icons-vue';

defineProps({
    type: {
        type: String,
        default: 'Channels'
    }
})
</script>
