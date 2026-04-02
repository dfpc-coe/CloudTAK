<template>
    <div class='d-flex align-items-center gap-2'>
        <TablerIconButton
            title='Home'
            @click='setCollection("")'
        >
            <IconFolder
                :size='20'
                stroke='1'
            />
        </TablerIconButton>

        <template
            v-for='(segment, idx) in segments'
            :key='`${idx}-${segment}`'
        >
            <IconChevronRight
                :size='20'
                stroke='1'
                class='text-white-50'
            />

            <span
                class='fw-semibold cursor-pointer hover-opacity'
                @click='setCollection(joinSegments(segments.slice(0, idx + 1)))'
            >{{ segment }}</span>
        </template>

        <span
            v-if='!segments.length'
            class='small text-white-50'
        >None</span>
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconFolder, IconChevronRight } from '@tabler/icons-vue';

const collection = defineModel<string>('collection', { required: true });

const segments = computed(() => {
    return String(collection.value || '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean);
});

function setCollection(path: string): void {
    collection.value = path;
}

function joinSegments(parts: string[]): string {
    return parts
        .map((part) => part.trim())
        .filter(Boolean)
        .join('/');
}
</script>