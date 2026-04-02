<template>
    <StandardItem class='d-flex align-items-center'>
        <div class='icon-wrapper d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 ms-2 my-2'>
            <IconFolder
                :size='24'
                stroke='1'
            />
        </div>
        <span class='fw-semibold ms-3'>{{ name }}</span>
    </StandardItem>
</template>

<script setup lang='ts'>
import StandardItem from './StandardItem.vue';
import { IconFolder } from '@tabler/icons-vue';

defineProps<{
    name: string;
}>();
</script>

<style scoped>
.icon-wrapper {
    width: 3rem;
    height: 3rem;
    min-width: 3rem;
    min-height: 3rem;
    flex-shrink: 0;
}
</style>