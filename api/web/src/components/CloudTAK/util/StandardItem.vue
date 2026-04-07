<template>
    <div
        class='standard-item position-relative'
        :class='{ "standard-item--hover": interactive }'
        :tabindex='interactive ? 0 : undefined'
        :role='interactive ? "menuitem" : undefined'
        @keydown.enter.prevent='interactive ? $el.click() : undefined'
        @keydown.space.prevent='interactive ? $el.click() : undefined'
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue';

const props = withDefaults(defineProps<{
    hover?: boolean;
}>(), {
    hover: true,
});

const attrs = useAttrs();

const interactive = computed(() => {
    return props.hover && typeof attrs.onClick === 'function';
});
</script>

<style scoped>
.standard-item {
    --standard-item-color: rgba(255, 255, 255, 0.92);
    --standard-item-muted-color: rgba(255, 255, 255, 0.68);
    --standard-item-border: rgba(255, 255, 255, 0.18);
    --standard-item-bg: rgba(0, 0, 0, 0.35);
    --standard-item-hover-border: rgba(255, 255, 255, 0.4);
    --standard-item-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
    --standard-item-icon-bg: rgba(0, 0, 0, 0.25);
    color: var(--standard-item-color);
    border: 1px solid var(--standard-item-border);
    border-radius: 14px;
    background-color: var(--standard-item-bg);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

[data-bs-theme='light'] .standard-item {
    --standard-item-color: var(--tblr-body-color);
    --standard-item-muted-color: var(--tblr-secondary-color);
    --standard-item-border: rgba(var(--tblr-primary-rgb), 0.16);
    --standard-item-bg: rgba(255, 255, 255, 0.82);
    --standard-item-hover-border: rgba(var(--tblr-primary-rgb), 0.28);
    --standard-item-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
    --standard-item-icon-bg: rgba(var(--tblr-primary-rgb), 0.08);
}

.standard-item :deep(.text-white) {
    color: var(--standard-item-color) !important;
}

.standard-item :deep(.text-white-50) {
    color: var(--standard-item-muted-color) !important;
}

.standard-item :deep(.bg-black.bg-opacity-25) {
    background-color: var(--standard-item-icon-bg) !important;
}

.standard-item--hover:hover,
.standard-item--hover:focus-within {
    transform: translateY(-1px);
    border-color: var(--standard-item-hover-border);
    box-shadow: var(--standard-item-shadow);
    cursor: pointer;
    z-index: 1;
}

.standard-item--hover:focus-within {
    z-index: 2;
}
</style>
