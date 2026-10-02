<template>
    <div :class='containerClass'>
        <TablerBorder
            :class='["cloudtak-accent", borderClass]'
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
                <GroupSelect
                    :model-value='draftValue'
                    :active='active'
                    :direction='direction'
                    :limit='limit'
                    @update:model-value='draftValue = $event'
                />
            </template>

            <template v-else>
                <div
                    v-if='value.length'
                    class='d-flex flex-wrap gap-2'
                >
                    <TablerBadge
                        v-for='group of value'
                        :key='group'
                        :class='badgeClass'
                        :background-color='badgeBackgroundColor'
                        :border-color='badgeBorderColor'
                        :text-color='badgeTextColor'
                    >
                        {{ group }}
                    </TablerBadge>
                </div>
                <p
                    v-else
                    :class='emptyClass'
                >
                    {{ emptyLabel }}
                </p>
            </template>
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { IconDeviceFloppy, IconPencil, IconX } from '@tabler/icons-vue';
import { TablerBadge, TablerBorder, TablerIconButton } from '@tak-ps/vue-tabler';
import { ref, watch } from 'vue';
import GroupSelect from './GroupSelect.vue';

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
    active?: boolean;
    direction?: string;
    limit?: number;
    saving?: boolean;
    saveLabel?: string;
    savingLabel?: string;
    emptyLabel?: string;
    emptyClass?: string;
    badgeClass?: string;
    badgeBackgroundColor?: string;
    badgeBorderColor?: string;
    badgeTextColor?: string;
}>(), {
    editable: false,
    label: 'Groups (Channels)',
    editTitle: 'Edit channels',
    containerClass: 'col-12',
    borderClass: undefined,
    labelClass: 'text-uppercase text-secondary d-block mb-0',
    background: '',
    shadow: false,
    fillHeight: false,
    gap: 'sm',
    active: true,
    direction: 'IN',
    limit: undefined,
    saving: false,
    saveLabel: 'Save',
    savingLabel: 'Saving...',
    emptyLabel: 'None',
    emptyClass: 'text-secondary mb-0',
    badgeClass: 'rounded-pill text-uppercase fw-semibold',
    badgeBackgroundColor: 'var(--tblr-secondary-lt)',
    badgeBorderColor: 'var(--tblr-border-color)',
    badgeTextColor: 'var(--tblr-secondary-color)'
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