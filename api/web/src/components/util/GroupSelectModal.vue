<template>
    <TablerModal
        style='height: 80vh;'
        @keyup.esc='$emit("close")'
    >
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @close='emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <div class='modal-title'>
                Channel Selection
            </div>
        </div>
        <div
            class='overflow-auto'
            style='height: 50vh;'
        >
            <GroupSelect
                :active='props.active'
                :model-value='modelValue'
                :connection='props.connection'
                @update:model-value='emit("update:modelValue", $event)'
            />
        </div>
        <div class='modal-footer'>
            <TablerButton
                class='btn btn-primary'
                :disabled='props.disabled'
                @click='emit("close")'
            >
                Submit
            </TablerButton>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import {
    TablerModal,
    TablerButton
} from '@tak-ps/vue-tabler';

import GroupSelect from './GroupSelect.vue';

const props = defineProps<{
    disabled?: boolean,
    connection?: number,
    limit?: number,
    active?: boolean,
    modelValue: Array<string>
}>();

const emit = defineEmits([
    'close',
    'update:modelValue'
]);
</script>
