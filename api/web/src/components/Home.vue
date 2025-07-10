<template>
    <CloudTAK
        v-if='user'
        :user='user'
    />
    <LandingPage v-else />
</template>

<script setup lang='ts'>
import CloudTAK from './CloudTAK/Map.vue';
import LandingPage from './LandingPage.vue';

defineProps({
    user: {
        type: Object,
        required: false
    }
});
</script>
