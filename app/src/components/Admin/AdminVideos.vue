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
            <span
                v-if='option.value === "admin-video-service"'
                title='Video Service'
            >
                <IconVideo
                    :size='32'
                    stroke='1'
                />
            </span>
            <span
                v-else
                title='Video Leases'
            >
                <IconServer2
                    :size='32'
                    stroke='1'
                />
            </span>
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
