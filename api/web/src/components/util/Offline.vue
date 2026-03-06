<template>
    <div class='card-body d-flex flex-column align-items-center justify-content-center py-4'>
        <IconCloudOff
            :size='48'
            stroke='1'
            class='text-muted mb-3'
        />
        <h3 class='text-center mb-2'>
            You're Offline
        </h3>
        <p class='text-center text-muted mb-0'>
            This feature requires a network connection.
            <br>
            Please check your connection and try again.
        </p>
    </div>
</template>

<script setup lang='ts'>
import {
    IconCloudOff
} from '@tabler/icons-vue';
</script>
