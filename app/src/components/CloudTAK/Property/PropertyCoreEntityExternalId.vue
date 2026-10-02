<template>
    <div class='col-12'>
        <IconHash
            :size='18'
            stroke='1'
            color='#6b7990'
            class='ms-2 me-1'
        />
        <label
            class='subheader user-select-none'
            v-text='"External ID"'
        />
        <div class='mx-2'>
            <CopyField
                :model-value='props.modelValue || "None"'
                :edit='props.edit'
                :hover='props.edit'
                :size='24'
                @submit='emit("update:modelValue", String($event))'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import CopyField from '../util/CopyField.vue';
import { IconHash } from '@tabler/icons-vue';

const props = defineProps<{
    /** ID of the Event in an external system */
    modelValue: string;
    edit?: boolean;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
}>();
</script>
