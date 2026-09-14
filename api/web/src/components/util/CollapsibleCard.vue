<template>
    <div>
        <div class='d-flex align-items-center user-select-none'>
            <label
                class='mx-1 mb-1'
                v-text='label'
            />
        </div>
        <div class='card'>
            <div
                class='card-body d-flex align-items-center user-select-none cursor-pointer'
                @click='expanded = !expanded'
            >
                <slot name='icon' />
                <div
                    class='mx-2'
                    v-text='summary'
                />
                <div class='ms-auto'>
                    <IconChevronDown
                        v-if='expanded'
                        :size='24'
                        stroke='1'
                    />
                    <IconChevronRight
                        v-else
                        :size='24'
                        stroke='1'
                    />
                </div>
            </div>

            <div
                v-if='expanded'
                class='card-body border-top'
            >
                <slot />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import {
    IconChevronDown,
    IconChevronRight,
} from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    label: string;
    summary: string;
    open?: boolean;
}>(), {
    open: false,
});

const expanded = ref(props.open);
</script>
