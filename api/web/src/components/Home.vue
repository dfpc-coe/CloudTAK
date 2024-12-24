<template>
    <CloudTAK
        v-if='user'
        :user='user'
    />
</template>

<script setup lang='ts'>
import CloudTAK from './CloudTAK/Map.vue';

const props = defineProps({
    user: {
        type: Object,
        required: true
    }
});
</script>
