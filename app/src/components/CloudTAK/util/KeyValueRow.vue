<template>
    <div class='d-flex align-items-center rounded px-1 py-1 cloudtak-hover-fill'>
        <span
            class='text-muted text-truncate flex-shrink-0'
            style='width: 33%'
            :title='name'
            v-text='name'
        />
        <span
            class='mx-2 text-truncate flex-fill'
            style='min-width: 0'
            :title='value'
            v-text='value'
        />
        <slot name='actions' />
    </div>
</template>

<script setup lang='ts'>
/** KeyValueRow - one entry of a free-form key/value list */
defineProps<{
    name: string;
    value: string;
}>();
</script>
