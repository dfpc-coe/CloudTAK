<template>
    <div
        class='single-container card bg-black bg-opacity-10 border border-light-subtle rounded-4 p-3 position-relative overflow-hidden'
        :class='{
            "single-container--editable": showEditTrigger
        }'
        :role='showEditTrigger ? "button" : undefined'
        :tabindex='showEditTrigger ? 0 : undefined'
        @click='showEditTrigger ? emit("edit") : undefined'
        @keyup.enter='showEditTrigger ? emit("edit") : undefined'
        @keyup.space.prevent='showEditTrigger ? emit("edit") : undefined'
    >
        <small class='text-uppercase text-white-50 d-block mb-2'>{{ label }}</small>

        <TablerIconButton
            v-if='showEditTrigger'
            :title='editAriaLabel'
            class='position-absolute single-container__hover-action'
            style='right: 8px; top: 8px;'
            @click.stop.prevent='emit("edit")'
        >
            <IconPencil
                :size='24'
                stroke='1'
            />
        </TablerIconButton>

        <slot
            v-if='editing'
            name='editor'
        />
        <slot v-else />
    </div>
</template>

<script setup lang='ts'>
import { computed } from 'vue';
import { TablerIconButton } from '@tak-ps/vue-tabler';
import { IconPencil } from '@tabler/icons-vue';

const props = withDefaults(defineProps<{
    label: string;
    editable?: boolean;
    editing?: boolean;
    editAriaLabel?: string;
}>(), {
    editable: false,
    editing: false,
    editAriaLabel: undefined,
});

const emit = defineEmits<{
    edit: [];
}>();

const showEditTrigger = computed(() => {
    return props.editable && !props.editing;
});

const editAriaLabel = computed(() => {
    return props.editAriaLabel || `Edit ${props.label.toLowerCase()}`;
});
</script>

<style scoped>
.single-container--editable {
    cursor: pointer;
}

.single-container--editable:focus-visible,
.single-container__hover-action:focus-visible {
    outline: 2px solid rgba(var(--tblr-primary-rgb, 32, 107, 196), 0.7);
    outline-offset: 2px;
    border-radius: 0.25rem;
}

.single-container__hover-action {
    opacity: 0;
}

.single-container--editable:hover .single-container__hover-action,
.single-container--editable:focus-visible .single-container__hover-action,
.single-container__hover-action:focus-visible {
    opacity: 1;
}

.single-container :deep(.tag-entry) {
    margin: 0;
}
</style>