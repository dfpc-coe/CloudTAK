<template>
    <svg
        class='affiliation-frame flex-shrink-0'
        :width='size'
        :height='size'
        viewBox='0 0 14 14'
        overflow='visible'
        aria-hidden='true'
    >
        <rect
            v-if='shape === "rectangle"'
            x='1'
            y='3.5'
            width='12'
            height='7'
            :style='style'
        />
        <polygon
            v-else-if='shape === "diamond"'
            points='7,1 13,7 7,13 1,7'
            :style='style'
        />
        <rect
            v-else-if='shape === "square"'
            x='2'
            y='2'
            width='10'
            height='10'
            :style='style'
        />
        <path
            v-else
            d='M4,4 A3,3 0 1 1 10,4 A3,3 0 1 1 10,10 A3,3 0 1 1 4,10 A3,3 0 1 1 4,4 Z'
            :style='style'
        />
    </svg>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { FAMILY_COLORS } from '../../../utils/appearance.ts';
import type { AffiliationFamily } from '../../../utils/appearance.ts';

/** The MIL-STD-2525 frame a standard identity is drawn with */
const props = withDefaults(defineProps<{
    family: AffiliationFamily;
    code?: string;
    size?: number;
}>(), {
    code: '',
    size: 14,
});

const shape = computed<'rectangle' | 'diamond' | 'square' | 'clover'>(() => {
    switch (props.family) {
        case 'friendly': return 'rectangle';
        case 'hostile': return 'diamond';
        case 'neutral': return 'square';
        default: return props.code === 'o' ? 'square' : 'clover';
    }
});

// Pending and None are the unknown/neutral frames with a dashed outline
const style = computed<Record<string, string>>(() => {
    const color = FAMILY_COLORS[props.family];
    const dashed = props.code === 'p' || props.code === 'o';

    return {
        fill: color,
        fillOpacity: dashed ? '0.4' : '1',
        stroke: 'currentColor',
        strokeWidth: '1.4',
        strokeLinejoin: 'round',
        strokeDasharray: dashed ? '2 1.5' : 'none',
    };
});
</script>

<style scoped>
.affiliation-frame {
    display: inline-block;
}
</style>
