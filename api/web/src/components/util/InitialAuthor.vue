<template>
    <div class='d-flex align-items-center'>
        <div>
            <IconUserEdit
                class='text-gray-500'
                :size='22'
                stroke='1'
            />
        </div>

        <div class='ms-2'>
            <div class='subheader user-select-none'>
                Author
            </div>
            <div v-text='props.email' />
        </div>
    </div>
</template>

<script setup lang='ts'>
import {
    IconUserEdit
} from '@tabler/icons-vue';

const props = defineProps<{
  email: string
}>();
</script>
