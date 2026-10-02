<template>
    <StandardItem
        class='h-100'
        @click='$emit("click")'
    >
        <div class='d-flex align-items-center gap-3 px-3 py-2'>
            <div
                class='d-flex align-items-center justify-content-center rounded-circle bg-black bg-opacity-25 flex-shrink-0'
                style='width: 48px; height: 48px;'
            >
                <component
                    :is='channel.active === false ? IconEyeOff : IconEye'
                    :size='24'
                    stroke='1'
                />
            </div>

            <div class='flex-grow-1 overflow-hidden'>
                <div
                    class='fw-semibold text-truncate'
                    v-text='channel.name'
                />
                <div
                    class='text-white-50 small text-truncate'
                    v-text='channel.description || "No Description"'
                />
            </div>

            <span
                v-if='direction'
                class='flex-shrink-0'
                :title='direction.label'
            >
                <component
                    :is='direction.icon'
                    :size='32'
                    stroke='1'
                />
            </span>

            <slot name='actions' />
        </div>
    </StandardItem>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import StandardItem from './StandardItem.vue';
import type { GroupChannel } from '../../../types.ts';
import {
    IconEye,
    IconEyeOff,
    IconLocation,
    IconLocationOff,
} from '@tabler/icons-vue';

export type StandardChannel = Pick<GroupChannel, 'name' | 'description'>
    & Partial<Pick<GroupChannel, 'direction' | 'active'>>;

const props = defineProps<{
    channel: StandardChannel;
}>();

defineEmits<{
    (e: 'click'): void;
}>();

const direction = computed(() => {
    const dir = props.channel.direction;
    if (!dir) return null;
    if (dir.length === 2) return { label: 'Bi-Directional', icon: IconLocation };
    if (dir.includes('IN')) return { label: 'Location Sharing', icon: IconLocation };
    if (dir.includes('OUT')) return { label: 'No Location Sharing', icon: IconLocationOff };
    return null;
});
</script>
