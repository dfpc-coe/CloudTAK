<template>
    <div
        class='col-lg-12 cloudtak-hover py-2 mt-2 cursor-pointer'
        @click='toggle'
    >
        <IconChevronDown v-if='isOpen' />
        <IconChevronRight v-else />

        <span class='mx-2 user-select-none'>Login Sessions</span>
    </div>
    <div
        v-if='isOpen'
        class='col-lg-12 card-body border rounded'
    >
        <LoginSessionsList :username='username' />
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import LoginSessionsList from '../util/LoginSessionsList.vue';
import {
    IconChevronDown,
    IconChevronRight,
} from '@tabler/icons-vue';

defineProps<{
    username: string;
}>();

const isOpen = ref(false);

function toggle(): void {
    isOpen.value = !isOpen.value;
}
</script>
