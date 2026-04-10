<template>
    <div class='card-header'>
        <h1 class='card-title'>
            ETL Task Runner Management
        </h1>
    </div>
    <TablerPillGroup
        :model-value='String(route.name)'
        :options='[
            { value: "admin-tasks-registered", label: "Registered Tasks" },
            { value: "admin-tasks-raw", label: "ECR Task Images" }
        ]'
        @update:model-value='(v: string) => router.push({ name: v })'
    >
        <template #option='{ option }'>
            <IconBuildingBroadcastTower
                v-if='option.value === "admin-tasks-registered"'
                v-tooltip='"Registered Tasks"'
                :size='32'
                stroke='1'
            />
            <IconBrandDocker
                v-else
                v-tooltip='"ECR Task Images"'
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
    IconBrandDocker,
    IconBuildingBroadcastTower
} from '@tabler/icons-vue'
import { TablerPillGroup } from '@tak-ps/vue-tabler';

const router = useRouter();
const route = useRoute();
</script>
