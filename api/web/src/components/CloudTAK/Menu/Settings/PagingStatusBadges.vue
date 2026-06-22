<template>
    <div class='d-flex align-items-center gap-1 flex-shrink-0'>
        <span
            v-if='source.verified'
            class='badge bg-green-lt d-inline-flex align-items-center gap-1'
        >
            <IconCircleCheck
                :size='14'
                stroke='2'
            />
            Verified
        </span>
        <span
            v-else
            class='badge bg-yellow-lt d-inline-flex align-items-center gap-1'
        >
            <IconAlertCircle
                :size='14'
                stroke='2'
            />
            Pending
        </span>
        <span
            v-if='source.enabled'
            class='badge bg-blue-lt'
        >
            Enabled
        </span>
    </div>
</template>

<script setup lang="ts">
import type { ProfilePaging } from '../../../../types.ts';
import {
    IconCircleCheck,
    IconAlertCircle,
} from '@tabler/icons-vue';

defineProps<{
    source: ProfilePaging;
}>();
</script>
