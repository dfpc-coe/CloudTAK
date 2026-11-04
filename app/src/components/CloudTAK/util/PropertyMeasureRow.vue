<template>
    <!-- Inline renders only the field so a caller can share one fact row between measures -->
    <component
        :is='inline ? "div" : PropertyFactRow'
        :label='inline ? undefined : label'
        :class='{ "py-1": !inline }'
    >
        <CopyField
            :model-value='modelValue'
            :display='display'
            :edit='edit'
            :hover='hover'
            :validate='validate'
            :size='24'
            @submit='emit("submit", $event)'
            @update:model-value='emit("update:modelValue", $event)'
        />
        <UnitSwitcher
            :model-value='unit'
            :options='units'
            @update:model-value='emit("update:unit", $event)'
        />
    </component>
</template>

<script setup lang='ts'>
/**
 * PropertyMeasureRow - a fact row for a measurement: the value in the
 * selected unit with the unit tabs beneath it. Conversion stays with the
 * caller, which owns the canonical value
 */
import CopyField from './CopyField.vue';
import PropertyFactRow from './PropertyFactRow.vue';
import UnitSwitcher, { type UnitOption } from './UnitSwitcher.vue';

withDefaults(defineProps<{
    label: string;
    modelValue: string | number;
    /** Rendered in place of modelValue; copy and edit still use modelValue */
    display?: string;
    unit: string;
    units: Array<UnitOption>;
    edit?: boolean;
    hover?: boolean;
    /** Render only the field - the caller provides the row & label */
    inline?: boolean;
    validate?: (text: string | number) => false | string;
}>(), {
    display: undefined,
    edit: false,
    hover: false,
    inline: false,
    validate: undefined,
});

const emit = defineEmits<{
    (e: 'submit', value: string | number): void
    (e: 'update:modelValue', value: string | number): void
    (e: 'update:unit', value: string): void
}>();
</script>
