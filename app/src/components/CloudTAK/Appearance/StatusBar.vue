<template>
    <svg
        class='status-bar flex-shrink-0'
        :width='width'
        :height='height'
        :viewBox='`0 0 ${width} ${height}`'
        aria-hidden='true'
    >
        <rect
            x='1'
            y='1'
            :width='width - 2'
            :height='height - 2'
            rx='2'
            :style='style'
        />
    </svg>
</template>

<script setup lang='ts'>
import { computed } from 'vue';

/** The MIL-STD-2525 operational condition bar drawn beneath a frame */
const props = withDefaults(defineProps<{
    status: string;
    width?: number;
    height?: number;
}>(), {
    width: 28,
    height: 10,
});

const STATUS_COLORS: Record<string, string> = {
    '2': '#4DD24D',
    '3': '#FFD21A',
    '4': '#FF4D4D',
    '5': '#4D8CFF',
};

// Present and Planned carry no bar - Planned is the dashed frame
const style = computed<Record<string, string>>(() => {
    const color = STATUS_COLORS[props.status];

    return {
        fill: color || 'transparent',
        stroke: color || 'currentColor',
        strokeWidth: '1.2',
        strokeOpacity: color ? '1' : '0.5',
        strokeDasharray: props.status === '1' ? '3 2' : 'none',
    };
});
</script>

<style scoped>
.status-bar {
    display: inline-block;
}
</style>
