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

const teamColors: Record<string, string> = {
    Yellow: 'var(--tblr-yellow)',
    Cyan: 'var(--tblr-cyan)',
    Green: 'var(--tblr-lime)',
    Red: 'var(--tblr-red)',
    Purple: 'var(--tblr-purple)',
    Orange: 'var(--tblr-orange)',
    Blue: 'var(--tblr-azure)',
    Magenta: 'var(--tblr-dribbble)',
    White: 'var(--tblr-white)',
    Maroon: 'var(--tblr-pinterest)',
    'Dark Blue': 'var(--tblr-blue)',
    Teal: 'var(--tblr-teal)',
    'Dark Green': 'var(--tblr-green)',
    Brown: 'var(--tblr-google)',
};

const teamColor = computed(() => {
    if (!props.team) return undefined;

    return teamColors[props.team];
});
</script>
