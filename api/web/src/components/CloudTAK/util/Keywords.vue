<template>
    <div
        v-if='filteredKeywords.length'
        class='d-flex flex-wrap gap-2 mt-1'
    >
        <TablerBadge
            v-for='keyword in filteredKeywords'
            :key='keyword'
            class='text-uppercase rounded-pill px-3 py-1 small'
            background-color='rgba(107, 114, 128, 0.2)'
            border-color='rgba(107, 114, 128, 0.5)'
            text-color='#6b7280'
        >
            {{ keyword }}
        </TablerBadge>
    </div>
    <div
        v-else
        class='text-white-50 small fst-italic'
        v-text='props.placeholder'
    />
</template>

<script setup lang="ts">
import  { computed } from 'vue';
import { TablerBadge } from '@tak-ps/vue-tabler';

const filtered = [
    'template:'
]

const filteredKeywords = computed(() => {
    return (props.keywords || []).filter((keyword) => {
        return filtered.some((filter) => keyword.startsWith(filter)) === false
    });
});

const props = withDefaults(defineProps<{
    keywords?: string[];
    placeholder?: string;
}>(), {
    keywords: () => [],
    placeholder: 'No Keywords'
});
</script>
