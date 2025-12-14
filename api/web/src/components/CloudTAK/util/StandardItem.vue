<template>
    <div
        class='standard-item text-white position-relative'
        :class='{ "standard-item--hover": hover }'
    >
        <slot />
    </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
    hover?: boolean;
}>(), {
    hover: true,
});
</script>

<style scoped>
.standard-item {
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 14px;
    background-color: rgba(0, 0, 0, 0.35);
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.standard-item--hover:hover,
.standard-item--hover:focus-within {
    transform: translateY(-1px);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}
</style>
