<template>
    <li>
        <button
            type='button'
            class='dropdown-item d-flex align-items-center gap-2'
            :class='{ "text-danger": danger }'
            :disabled='disabled'
            @click='emit("click")'
        >
            <slot name='icon' />
            <span
                class='text-truncate'
                v-text='label'
            />
        </button>
    </li>
</template>

<script setup lang='ts'>
/** MenuDropdownItem - one action in a TablerDropdown menu */
withDefaults(defineProps<{
    label: string;
    danger?: boolean;
    disabled?: boolean;
}>(), {
    danger: false,
    disabled: false,
});

const emit = defineEmits<{
    (e: 'click'): void
}>();
</script>
