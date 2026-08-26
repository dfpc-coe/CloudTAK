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
import {
    IconUserQuestion,
    IconCircleFilled,
} from '@tabler/icons-vue';

const props = defineProps<{
    team?: string,
    size?: number
}>();

// ATAK's actual team colours (Icon2525cIconAdapter.teamToColor()), matching
// base/cot.ts's TEAM_COLORS - not CSS/UI framework theme colours, which do
// not represent the named colour at all (see base/cot.ts for the full
// rationale).
const teamColors: Record<string, string> = {
    White: '#FFFFFF',
    Yellow: '#FFFF00',
    Orange: '#FF7700',
    Magenta: '#FF00FF',
    Red: '#FF0000',
    Maroon: '#7F0000',
    Purple: '#7F007F',
    'Dark Blue': '#00007F',
    Blue: '#0000FF',
    Cyan: '#00FFFF',
    Teal: '#007F7F',
    Green: '#00FF00',
    'Dark Green': '#007F00',
    Brown: '#A0714F',
};

const teamColor = computed(() => {
    if (!props.team) return undefined;

    return teamColors[props.team];
});
</script>
