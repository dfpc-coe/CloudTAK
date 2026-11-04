<template>
    <section class='pt-2'>
        <div
            class='d-flex align-items-center px-2 pb-1'
            style='min-height: 32px;'
        >
            <label
                class='subheader user-select-none m-0'
                v-text='label'
            />
            <CountBadge
                v-if='count !== undefined'
                class='ms-2'
                :count='count'
            />
            <div class='ms-auto d-flex align-items-center gap-1'>
                <slot name='actions' />
            </div>
        </div>
        <div class='px-2'>
            <slot />
        </div>
    </section>
</template>

<script setup lang='ts'>
/**
 * PropertySection - an always-open group of related properties: a subheader
 * with an optional count & actions, then the rows. The compact replacement
 * for SlideDownHeader where a section lives inside a tab
 */
import CountBadge from './CountBadge.vue';

defineProps<{
    label: string;
    count?: number;
}>();
</script>
