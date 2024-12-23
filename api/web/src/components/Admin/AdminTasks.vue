<template>
    <div class='card-header'>
        <h1 class='card-title'>
            ETL Task Runner Management
        </h1>
    </div>
    <div
        class='px-2 py-2 round btn-group w-100'
        role='group'
    >
        <input
            id='registered'
            type='radio'
            class='btn-check'
            autocomplete='off'
            :checked='route.name === "admin-tasks-registered"'
            @click='router.push({ name: `admin-tasks-registered` })'
        >
        <label
            for='registered'
            type='button'
            class='btn btn-sm'
        ><IconBuildingBroadcastTower
            v-tooltip='"Video Service"'
            :size='32'
            stroke='1'
        /><span class='mx-2'>Registered Tasks</span></label>

        <input
            id='raw'
            type='radio'
            class='btn-check'
            autocomplete='off'
            :checked='route.name === "admin-tasks-raw"'
            @click='router.push({ name: `admin-tasks-raw` })'
        >
        <label
            for='raw'
            type='button'
            class='btn btn-sm'
        ><IconBrandDocker
            v-tooltip='"Video Leases"'
            :size='32'
            stroke='1'
        /><span class='mx-2'>ECR Task Images</span></label>
    </div>

    <router-view />
</template>

<script setup lang='ts'>
import { useRouter, useRoute } from 'vue-router';
import {
    IconBrandDocker,
    IconBuildingBroadcastTower
} from '@tabler/icons-vue'

const router = useRouter();
const route = useRoute();
</script>
