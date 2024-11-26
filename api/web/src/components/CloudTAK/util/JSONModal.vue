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
            <div
                class='modal-title'
                v-text='title'
            />
        </div>
        <div class='modal-body overflow-auto'>
            <CopyField
                v-model='json'
                :pre='true'
            />
        </div>
        <div class='modal-footer'>
            <TablerButton @click='emit("close")'>
                Done
            </TablerButton>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import CopyField from './CopyField.vue';
import {
    TablerModal,
    TablerButton
} from '@tak-ps/vue-tabler';

const props = defineProps({
    title: {
        type: String,
        default: 'JSON Object'
    },
    object: {
        type: Object,
        required: true
    }
});

const json = ref(JSON.stringify(props.object, null, 4));

watch(props.object, () => {
    json.value =  JSON.stringify(props.object, null, 4)
})

const emit = defineEmits(['close']);
</script>
