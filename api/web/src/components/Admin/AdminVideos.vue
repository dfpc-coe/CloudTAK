<template>
    <div class='card-header'>
        <h1 class='card-title'>
            Video Management
        </h1>
    </div>
    <TablerPillGroup
        :model-value='String(route.name)'
        :options='[
            { value: "admin-video-service", label: "Video Service" },
            { value: "admin-video-leases", label: "Video Leases" }
        ]'
        @update:model-value='(v: string) => router.push({ name: v })'
    >
        <template #option='{ option }'>
            <IconVideo
                v-if='option.value === "admin-video-service"'
                v-tooltip='"Video Service"'
                :size='32'
                stroke='1'
            />
            <IconServer2
                v-else
                v-tooltip='"Video Leases"'
                :size='32'
                stroke='1'
            />
            <span class='mx-2'>{{ option.label }}</span>
        </template>
    </TablerPillGroup>

    <router-view />
</template>

<script setup lang='ts'>
import { useRouter, useRoute } from 'vue-router';
import {
    IconVideo,
    IconServer2
} from '@tabler/icons-vue'
import { TablerPillGroup } from '@tak-ps/vue-tabler';

const router = useRouter();
const route = useRoute();
</script>
