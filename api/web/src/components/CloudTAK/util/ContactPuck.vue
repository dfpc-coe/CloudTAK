<template>
    <IconCircleFilled
        v-if='props.team'
        :size='props.size ? props.size : 32'
        :color='teamColor'
        stroke='1'
    />
    <IconUserQuestion
        v-else
        :size='props.size ? props.size : 32'
        stroke='1'
    />
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { TEAM_COLORS } from '../../../utils/team-colors.ts';
import {
    IconUserQuestion,
    IconCircleFilled,
} from '@tabler/icons-vue';

const props = defineProps<{
    team?: string,
    size?: number
}>();

const teamColor = computed(() => {
    if (!props.team) return undefined;

    return TEAM_COLORS[props.team];
});
</script>
