<template>
    <div
        class='d-flex align-items-center mx-1 px-2'
        style='min-height: 36px;'
    >
        <label
            class='subheader user-select-none m-0 flex-shrink-0 fact-label'
            v-text='label'
        />
        <div
            class='flex-grow-1'
            style='min-width: 0;'
        >
            <slot />
        </div>
        <div
            v-if='$slots.actions'
            class='ms-2 d-flex align-items-center flex-shrink-0'
        >
            <slot name='actions' />
        </div>
    </div>
</template>

<script setup lang='ts'>
/** PropertyFactRow - a single label/value line in a compact key-value list */
defineProps<{
    label: string;
}>();
</script>

<style scoped>
.fact-label {
    width: 84px;
}
</style>
