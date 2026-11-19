<template>
    <button
        v-if='sharing.paused'
        type='button'
        class='sharing-paused-pill btn btn-sm d-flex align-items-center'
        :disabled='sharing.busy'
        aria-label='Sharing is paused. Tap to resume'
        @click.stop.prevent='sharing.resume()'
    >
        <IconBroadcastOff
            :size='16'
            stroke='2'
            class='me-1'
        />
        <span>{{ sharing.busy ? 'Resuming…' : 'Paused · Tap to resume' }}</span>
    </button>
</template>

<script setup lang='ts'>
import { IconBroadcastOff } from '@tabler/icons-vue';
import { useSharingStore } from '../../stores/sharing.ts';

const sharing = useSharingStore();
</script>

<style scoped>
.sharing-paused-pill {
    background-color: #f59f00;
    color: #1d273b;
    border: 0;
    border-radius: 999px;
    font-weight: 600;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
}
</style>
