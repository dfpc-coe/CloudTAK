<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='modal = false'
        />
        <div class='modal-status bg-red' />
        <div class='modal-header text-center py-4'>
            Deletion Confirmation
        </div>
        <div class='modal-body text-center py-4'>
            Are you sure you wish to perform this deletion?
        </div>
        <div class='modal-footer'>
            <div
                class='btn btn-danger'
                @click='$emit("delete")'
            >
                <IconTrash
                    :size='32'
                    stroke='1'
                /><span
                    class='mx-2'
                    v-text='label'
                />
            </div>
        </div>
    </TablerModal>
</template>

<script setup>
import {
    TablerModal
} from '@tak-ps/vue-tabler'
import {
    IconTrash
} from '@tabler/icons-vue';

defineProps({
    label: {
        type: String,
        default: 'Delete'
    },
    size: {
        type: Number,
        default: 32
    },
    displaytype: {
        type: String,
        default: 'button'
    }
});

defineEmits(['delete']);
</script>
