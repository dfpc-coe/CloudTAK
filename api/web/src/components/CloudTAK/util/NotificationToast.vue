<template>
<div
    class='position-absolute'
    style='
        z-index: 1;
        right: 100px;
        border-bottom-left-radius: 6px;
        background-color: rgba(0, 0, 0, 0.5);
        height: 56px;
    '
>
    <p>This is a notification toast that will disappear after 3 seconds.</p>
</div>
</template>

<script setup lang='ts'>
import { ref, onMounted, onUnmounted } from 'vue';

const timer = ref<ReturnType<typeof setTimeout> | null>(null);

onMounted(() => {
    timer.value = setTimeout(() => {
        clearTimeout(timer.value!);
    }, 3000);
});

</script>
