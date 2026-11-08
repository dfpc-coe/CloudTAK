<template>
    <ul
        ref='list'
        class='nav nav-tabs flex-nowrap px-2'
        :class='{ "property-tabs--compact": compact }'
        role='tablist'
    >
        <li
            v-for='tab of tabs'
            :key='tab.value'
            class='nav-item'
            role='presentation'
        >
            <button
                type='button'
                role='tab'
                class='nav-link d-flex align-items-center gap-2 px-3 py-2'
                :class='{ active: tab.value === modelValue }'
                :aria-selected='tab.value === modelValue'
                :aria-label='tab.label'
                :title='compact ? tab.label : undefined'
                @click='emit("update:modelValue", tab.value)'
            >
                <component
                    :is='tab.icon'
                    v-if='tab.icon'
                    class='property-tabs-icon'
                    :size='28'
                    stroke='1'
                />
                <span
                    class='property-tabs-label'
                    :class='{ "property-tabs-label--optional": tab.icon }'
                    v-text='tab.label'
                />
                <CountBadge
                    v-if='tab.count'
                    :count='tab.count'
                />
            </button>
        </li>
    </ul>
</template>

<script setup lang='ts'>
/**
 * PropertyTabs - a single row of tabs. When the labels no longer fit the
 * row collapses to icons only, growing the labels back as room returns
 */
import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import type { Component } from 'vue';
import CountBadge from './CountBadge.vue';

export type PropertyTab = {
    value: string;
    label: string;
    /** Icon component shown before the label, and alone when the row is too narrow for labels */
    icon?: Component;
    /** Shown as a badge after the label when non-zero */
    count?: number;
};

const props = defineProps<{
    modelValue: string;
    tabs: Array<PropertyTab>;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>();

const list = ref<HTMLElement>();
const compact = ref(false);

let observer: ResizeObserver | undefined;
let frame: number | undefined;

onMounted(() => {
    if (typeof ResizeObserver !== 'undefined' && list.value) {
        // Measuring toggles the row's class, so it runs on the next frame
        // rather than inside the observer's own delivery cycle
        observer = new ResizeObserver(() => {
            if (frame !== undefined) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                frame = undefined;
                measure();
            });
        });
        observer.observe(list.value);
    }

    measure();
});

onBeforeUnmount(() => {
    if (observer) observer.disconnect();
    if (frame !== undefined) cancelAnimationFrame(frame);
});

watch(() => props.tabs, async () => {
    await nextTick();
    measure();
}, { deep: true });

/** Labels are shown only when the full row fits - measured with them visible so the check never oscillates */
function measure(): void {
    const el = list.value;
    if (!el) return;

    const wasCompact = el.classList.contains('property-tabs--compact');
    el.classList.remove('property-tabs--compact');

    const fits = el.scrollWidth <= el.clientWidth;

    if (wasCompact) el.classList.add('property-tabs--compact');

    compact.value = !fits;
}
</script>

<style scoped>
/* Labelled tabs carry a small icon; icon-only tabs sit just under the toolbar's 28px icons */
.property-tabs-icon {
    width: 18px;
    height: 18px;
}

.property-tabs--compact .nav-link {
    padding: 0.25rem 0.75rem;
}

.property-tabs--compact .property-tabs-icon {
    width: 24px;
    height: 24px;
}

.property-tabs--compact .property-tabs-label--optional {
    display: none;
}
</style>
