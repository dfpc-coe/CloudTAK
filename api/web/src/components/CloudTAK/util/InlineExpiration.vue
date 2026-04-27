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
                        v-if='showClear'
                        :disabled='saving'
                        :title='clearLabel'
                        @click.stop='emit("clear")'
                    >
                        <IconTrash stroke='1' />
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
                <TablerInput
                    :label='inputLabel'
                    type='datetime-local'
                    :model-value='draftValue'
                    @update:model-value='draftValue = String($event || "")'
                />
            </template>

            <button
                v-else-if='value && interactive'
                type='button'
                :class='displayClass'
                @click.stop='emit("displayClick")'
                v-text='value'
            />
            <p
                v-else-if='value'
                :class='displayClass'
                v-text='value'
            />
            <p
                v-else
                :class='emptyClass'
            >
                {{ emptyLabel }}
            </p>
        </TablerBorder>
    </div>
</template>

<script setup lang='ts'>
import { IconDeviceFloppy, IconPencil, IconTrash, IconX } from '@tabler/icons-vue';
import { TablerBorder, TablerIconButton, TablerInput } from '@tak-ps/vue-tabler';
import { ref, watch } from 'vue';

const props = withDefaults(defineProps<{
    value?: string | null;
    modelValue: string;
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
    inputLabel?: string;
    emptyLabel?: string;
    emptyClass?: string;
    displayClass?: string;
    interactive?: boolean;
    showClear?: boolean;
    clearLabel?: string;
    saveLabel?: string;
    savingLabel?: string;
}>(), {
    value: null,
    editable: false,
    label: 'Expiry',
    editTitle: 'Edit expiry',
    containerClass: 'col-12',
    borderClass: undefined,
    labelClass: 'text-uppercase text-white-50 d-block mb-0',
    background: 'rgba(0, 0, 0, 0.1)',
    shadow: false,
    fillHeight: false,
    gap: 'sm',
    saving: false,
    inputLabel: 'Expiration Time',
    emptyLabel: 'None',
    emptyClass: 'text-start text-white fw-semibold p-0 mb-0 text-decoration-none',
    displayClass: 'text-start text-white fw-semibold p-0 mb-0 text-decoration-none',
    interactive: false,
    showClear: true,
    clearLabel: 'Clear',
    saveLabel: 'Save',
    savingLabel: 'Saving...'
});

const emit = defineEmits<{
    'update:modelValue': [value: string];
    edit: [];
    cancel: [];
    clear: [];
    save: [value: string];
    displayClick: [];
}>();

const draftValue = ref(props.modelValue);

watch(() => props.modelValue, (modelValue) => {
    if (!props.editing) draftValue.value = modelValue;
}, { immediate: true });

watch(() => props.editing, (editing) => {
    if (editing) draftValue.value = props.modelValue;
});

function commitDraft(): void {
    emit('update:modelValue', draftValue.value);
    emit('save', draftValue.value);
}

function revertDraft(): void {
    draftValue.value = props.modelValue;
    emit('cancel');
}
</script>