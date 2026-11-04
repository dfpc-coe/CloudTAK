<template>
    <PropertyFactRow
        label='Email'
        class='py-1'
    >
        <a
            :href='`mailto:${email}`'
            class='text-reset d-block text-truncate'
            v-text='email'
        />
    </PropertyFactRow>
</template>

<script setup lang='ts'>
import PropertyFactRow from '../util/PropertyFactRow.vue';

defineProps<{
    email: string;
}>();
</script>
