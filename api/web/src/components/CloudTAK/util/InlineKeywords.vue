<template>
    <div :class='containerClass'>
        <TablerBorder
            :class='borderClass'
            :background='background'
            :shadow='shadow'
            :fill-height='fillHeight'
            :gap='gap'
        >
            <template #label>
                <small :class='labelClass'>{{ label }}</small>
            </template>
            <template
                v-if='editable && !editing'
                #tools
            >
                <TablerIconButton
                    :title='editTitle'
                    @click.stop.prevent='emit("edit")'
                >
                    <IconPencil
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </template>
            <template
                v-else-if='editing'
                #tools
            >
                <div class='d-flex gap-1'>
                    <TablerIconButton
                        :disabled='saving'
                        color='rgba(var(--tblr-primary-rgb), 0.14)'
                        :title='saving ? savingLabel : saveLabel'
                        @click.stop='commitDraft'
                    >
                        <IconDeviceFloppy
                            color='rgb(var(--tblr-primary-rgb))'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerIconButton
                        :disabled='saving'
                        title='Cancel'
                        @click.stop='revertDraft'
                    >
                        <IconX stroke='1' />
                    </TablerIconButton>
                </div>
            </template>

            <template v-if='editing'>
                <TagEntry
                    :model-value='draftValue'
                    :placeholder='inputPlaceholder'
                    @update:model-value='draftValue = $event'
                />
            </template>

            <Keywords
                v-else
                :keywords='value'
                :placeholder='placeholder'
                :tone='tone'
            />
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { IconDeviceFloppy, IconPencil, IconX } from '@tabler/icons-vue';
import { TablerBorder, TablerIconButton } from '@tak-ps/vue-tabler';
import { ref, watch } from 'vue';
import Keywords from './Keywords.vue';
import TagEntry from './TagEntry.vue';

const props = withDefaults(defineProps<{
    value: string[];
    modelValue: string[];
    editing: boolean;
    editable?: boolean;
    label?: string;
    editTitle?: string;
    containerClass?: string;
    borderClass?: string;
    labelClass?: string;
    background?: string;
    shadow?: boolean;
    fillHeight?: boolean;
    gap?: string;
    saving?: boolean;
    placeholder?: string;
    inputPlaceholder?: string;
    tone?: 'muted' | 'accent';
    saveLabel?: string;
    savingLabel?: string;
}>(), {
    editable: false,
    label: 'Keywords',
    editTitle: 'Edit keywords',
    containerClass: 'col-12',
    borderClass: undefined,
    labelClass: 'text-uppercase text-white-50 d-block mb-0',
    background: 'rgba(0, 0, 0, 0.1)',
    shadow: false,
    fillHeight: false,
    gap: 'sm',
    saving: false,
    placeholder: 'No keywords provided',
    inputPlaceholder: 'Add keywords',
    tone: 'accent',
    saveLabel: 'Save',
    savingLabel: 'Saving...'
});

const emit = defineEmits<{
    'update:modelValue': [value: string[]];
    edit: [];
    cancel: [];
    save: [value: string[]];
}>();

const draftValue = ref<string[]>([...props.modelValue]);

watch(() => props.modelValue, (modelValue) => {
    if (!props.editing) draftValue.value = [...modelValue];
}, { deep: true, immediate: true });

watch(() => props.editing, (editing) => {
    if (editing) draftValue.value = [...props.modelValue];
});

function commitDraft(): void {
    const nextValue = [...draftValue.value];
    emit('update:modelValue', nextValue);
    emit('save', nextValue);
}

function revertDraft(): void {
    draftValue.value = [...props.modelValue];
    emit('cancel');
}
</script>