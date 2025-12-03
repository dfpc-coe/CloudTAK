<template>
    <div
        v-if='keywords && keywords.length'
        class='d-flex flex-wrap gap-2 mt-1'
    >
        <span
            v-for='keyword in filteredKeywords'
            :key='keyword'
            class='badge text-bg-secondary text-uppercase rounded-pill px-3 py-1 small'
            v-text='keyword'
        />
    </div>
</template>

<script setup lang="ts">
import  { computed } from 'vue';

const filtered = [
    'template:'
]

const filteredKeywords = computed(() => {
    return props.keywords.filter((keyword) => {
        return filtered.some((filter) => keyword.startsWith(filter)) === false
    });
});

const props = defineProps<{
    keywords: string[];
}>();
</script>
