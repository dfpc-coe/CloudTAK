<template>
    <IconAlertTriangle
        v-if='type === "Alert"'
        :size='props.size'
        stroke='1'
    />
    <IconHeartbeat
        v-else-if='type === "Medical"'
        :size='props.size'
        stroke='1'
    />
    <IconMessage
        v-else-if='type === "Chat"'
        :size='props.size'
        stroke='1'
    />
    <IconUser
        v-else-if='type === "Contact"'
        :size='props.size'
        stroke='1'
    />
    <IconAmbulance
        v-else-if='type === "Mission"'
        :size='props.size'
        stroke='1'
    />
    <IconCircleDot
        v-else
        :size='props.size'
        stroke='1'
    />
</template>
<script setup lang='ts' >
import {
    IconUser,
    IconMessage,
    IconAlertTriangle,
    IconHeartbeat,
    IconAmbulance,
    IconCircleDot,
} from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    type: string;
    size?: number;
}>(), {
    size: 32,
});
</script>
