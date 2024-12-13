<template>
    <div class='card-header'>
        <h1 class='card-title'>
            Video Management
        </h1>
    </div>
    <div
        class='px-2 py-2 round btn-group w-100'
        role='group'
    >
        <input
            id='service'
            type='radio'
            class='btn-check'
            autocomplete='off'
            :checked='route.name === "admin-video-service"'
            @click='router.push({ name: `admin-video-service` })'
        >
        <label
            for='service'
            type='button'
            class='btn btn-sm'
        ><IconVideo
            v-tooltip='"Video Service"'
            :size='32'
            stroke='1'
        /><span class='mx-2'>Video Service</span></label>

        <input
            id='leases'
            type='radio'
            class='btn-check'
            autocomplete='off'
            :checked='route.name === "admin-video-leases"'
            @click='router.push({ name: `admin-video-leases` })'
        >
        <label
            for='leases'
            type='button'
            class='btn btn-sm'
        ><IconServer2
            v-tooltip='"Video Leases"'
            :size='32'
            stroke='1'
        /><span class='mx-2'>Video Leases</span></label>

        <input
            id='tasks'
            type='radio'
            class='btn-check'
            autocomplete='off'
            :checked='route.name === "admin-video-tasks"'
            @click='router.push({ name: `admin-video-tasks` })'
        >
        <label
            for='tasks'
            type='button'
            class='btn btn-sm'
        ><IconServer2
            v-tooltip='"Video Tasks"'
            :size='32'
            stroke='1'
        /><span class='mx-2'>Manual Video Servers</span></label>
    </div>

    <router-view />
</template>

<script setup lang='ts'>
import { useRouter, useRoute } from 'vue-router';
import {
    IconVideo,
    IconServer2
} from '@tabler/icons-vue'

const router = useRouter();
const route = useRoute();
</script>
