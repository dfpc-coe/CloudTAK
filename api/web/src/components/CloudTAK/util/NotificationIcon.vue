<template>
    <IconAlertTriangle
        v-if='type === NotificationType.Alert'
        :size='props.size'
        stroke='1'
    />
    <IconHeartbeat
        v-else-if='type === NotificationType.Medical'
        :size='props.size'
        stroke='1'
    />
    <IconMessage
        v-else-if='type === NotificationType.Chat'
        :size='props.size'
        stroke='1'
    />
    <IconUser
        v-else-if='type === NotificationType.Contact'
        :size='props.size'
        stroke='1'
    />
    <IconAmbulance
        v-else-if='type === NotificationType.Mission'
        :size='props.size'
        stroke='1'
    />
    <IconCircleDot
        v-else
        :size='props.size'
        stroke='1'
    />
</template>
<script setup lang='ts'>
import { NotificationType } from '../../../base/notification.ts';
import {
    IconUser,
    IconMessage,
    IconAlertTriangle,
    IconHeartbeat,
    IconAmbulance,
    IconCircleDot,
} from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    type: NotificationType;
    size?: number;
}>(), {
    size: 32,
});
</script>
