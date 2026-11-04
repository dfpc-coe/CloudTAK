<template>
    <ul
        class='nav nav-tabs px-2'
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
                @click='emit("update:modelValue", tab.value)'
            >
                <span v-text='tab.label' />
            </button>
        </li>
    </ul>
</template>

<script setup lang='ts'>
export type PropertyTab = {
    value: string;
    label: string;
};

defineProps<{
    modelValue: string;
    tabs: Array<PropertyTab>;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>();
</script>
