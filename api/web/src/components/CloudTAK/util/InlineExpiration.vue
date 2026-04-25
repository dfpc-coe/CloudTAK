<template>
    <div>
        <template v-if='editing'>
            <TablerInput
                :label='inputLabel'
                type='datetime-local'
                :model-value='modelValue'
                @update:model-value='emit("update:modelValue", String($event || ""))'
            />

            <div class='d-flex justify-content-end gap-2 pt-2'>
                <TablerButton
                    :disabled='saving'
                    @click.stop='emit("cancel")'
                >
                    Cancel
                </TablerButton>
                <TablerButton
                    v-if='showClear'
                    :disabled='saving'
                    @click.stop='emit("clear")'
                >
                    {{ clearLabel }}
                </TablerButton>
                <TablerButton
                    class='btn-primary'
                    :disabled='saving'
                    @click.stop='emit("save")'
                >
                    {{ saving ? savingLabel : saveLabel }}
                </TablerButton>
            </div>
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
    </div>
</template>

<script setup lang='ts'>
import { TablerButton, TablerInput } from '@tak-ps/vue-tabler';

withDefaults(defineProps<{
    value?: string | null;
    modelValue: string;
    editing: boolean;
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
    cancel: [];
    clear: [];
    save: [];
    displayClick: [];
}>();
</script>