<template>
    <div
        role='menu'
        class='mx-1 d-flex flex-wrap'
    >
        <span
            v-for='option of options'
            :key='option.value'
            role='menuitem'
            tabindex='0'
            class='my-1 px-1 me-1 user-select-none small text-nowrap'
            :class='{
                "cloudtak-accent rounded-bottom text-blue": option.value === modelValue,
                "cursor-pointer": option.value !== modelValue,
            }'
            :title='option.title'
            @keyup.enter='emit("update:modelValue", option.value)'
            @click='emit("update:modelValue", option.value)'
            v-text='option.label'
        />
    </div>
</template>

<script setup lang='ts'>
/**
 * UnitSwitcher - the row of unit tabs under a measurement field. Lives below
 * the value rather than beside it so a long value is never truncated
 */
export type UnitOption = {
    value: string;
    /** Short label shown in the tab, ie "ft" */
    label: string;
    /** Long name shown on hover, ie "Feet" */
    title?: string;
};

defineProps<{
    modelValue: string;
    options: Array<UnitOption>;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>();
</script>
