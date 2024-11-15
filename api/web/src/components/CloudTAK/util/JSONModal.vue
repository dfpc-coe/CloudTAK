<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-green' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-white'>
            <div class='modal-title' v-text='title'/>
        </div>
        <div class='modal-body overflow-auto'>
            <CopyField :text='JSON.stringify(object, null, 4)' :pre='true'/>
        </div>
        <div class='modal-footer'>
            <TablerButton @click='emit("close")'>Done</TablerButton>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import CopyField from './CopyField.vue';
import {
    TablerModal,
    TablerButton
} from '@tak-ps/vue-tabler';

defineProps({
    title: {
        type: String,
        default: 'JSON Object'
    },
    object: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['close']);
</script>
