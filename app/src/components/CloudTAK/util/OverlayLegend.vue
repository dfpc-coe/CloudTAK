<template>
    <div
        class='d-flex flex-wrap align-items-center gap-2 small text-white-50'
        role='list'
        aria-label='Legend'
    >
        <span
            v-for='entry in legend'
            :key='entry.label'
            class='d-inline-flex align-items-center gap-1'
            role='listitem'
        >
            <span
                class='legend-swatch rounded-1 flex-shrink-0'
                :style='{ backgroundColor: entry.color }'
            />
            {{ entry.label }}
        </span>
    </div>
</template>

<script setup lang='ts'>
defineProps<{
    legend: Array<{ label: string; color: string }>;
}>();
</script>

<style scoped>
.legend-swatch {
    width: 12px;
    height: 12px;
    border: 1px solid rgba(255, 255, 255, 0.35);
}
</style>
