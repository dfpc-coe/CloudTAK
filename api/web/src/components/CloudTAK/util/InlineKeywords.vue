<template>
    <div>
        <template v-if='editing'>
            <TagEntry
                :model-value='modelValue'
                :placeholder='inputPlaceholder'
                @update:model-value='emit("update:modelValue", $event)'
            />

            <div class='d-flex justify-content-end gap-2 pt-2'>
                <TablerButton
                    :disabled='saving'
                    @click.stop='emit("cancel")'
                >
                    Cancel
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

        <Keywords
            v-else
            :keywords='value'
            :placeholder='placeholder'
            :tone='tone'
        />
    </div>
</template>

<script setup lang='ts'>
import { TablerButton } from '@tak-ps/vue-tabler';
import Keywords from './Keywords.vue';
import TagEntry from './TagEntry.vue';

withDefaults(defineProps<{
    value: string[];
    modelValue: string[];
    editing: boolean;
    saving?: boolean;
    placeholder?: string;
    inputPlaceholder?: string;
    tone?: 'muted' | 'accent';
    saveLabel?: string;
    savingLabel?: string;
}>(), {
    saving: false,
    placeholder: 'No keywords provided',
    inputPlaceholder: 'Add keywords',
    tone: 'accent',
    saveLabel: 'Save',
    savingLabel: 'Saving...'
});

const emit = defineEmits<{
    'update:modelValue': [value: string[]];
    cancel: [];
    save: [];
}>();
</script>