<template>
    <div class='paging-empty-hint text-secondary small d-flex align-items-center justify-content-center text-center px-3 py-3'>
        {{ label }}
    </div>
</template>

<script setup lang="ts">
defineProps<{
    label: string;
}>();
</script>

<style scoped>
.paging-empty-hint {
    border: 1px dashed rgba(255, 255, 255, 0.18);
    border-radius: 14px;
    background-color: rgba(0, 0, 0, 0.15);
}

[data-bs-theme='light'] .paging-empty-hint {
    border-color: rgba(var(--tblr-primary-rgb), 0.16);
    background-color: rgba(255, 255, 255, 0.45);
}
</style>
