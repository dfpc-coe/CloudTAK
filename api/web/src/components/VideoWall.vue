<template>
    <VideoWall
        v-if='user'
        :user='user'
    />
</template>

<script setup lang='ts'>
import VideoWall from './VideoWall/Main.vue';

defineProps({
    user: {
        type: Object,
        required: true
    }
});
</script>
