<template>
    <div
        v-if='filteredKeywords.length'
        class='d-flex flex-wrap gap-2 mt-1'
    >
        <TablerBadge
            v-for='keyword in filteredKeywords'
            :key='keyword'
            class='text-uppercase rounded-pill px-3 py-1 small'
            :background-color='badgeColors.backgroundColor'
            :border-color='badgeColors.borderColor'
            :text-color='badgeColors.textColor'
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

const badgeColors = computed(() => {
    if (props.tone === 'accent') {
        return {
            backgroundColor: 'rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.18)',
            borderColor: 'rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.42)',
            textColor: 'var(--tblr-primary-text-emphasis, rgb(var(--tblr-primary-rgb, 32, 107, 196)))'
        };
    }

    return {
        backgroundColor: 'rgba(107, 114, 128, 0.2)',
        borderColor: 'rgba(107, 114, 128, 0.5)',
        textColor: '#6b7280'
    };
});

const props = withDefaults(defineProps<{
    keywords?: string[];
    placeholder?: string;
    tone?: 'muted' | 'accent';
}>(), {
    keywords: () => [],
    placeholder: 'No Keywords',
    tone: 'muted'
});
</script>
