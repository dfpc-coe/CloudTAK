<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='close'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <div class='modal-title'>
                Create Feature Service
            </div>
        </div>
        <div class='modal-body row'>
            <div class='col-12'>
                <TablerInput
                    v-model='data.name'
                    label='Service Name'
                    @keyup.enter='create'
                />
            </div>
            <div class='col-12 mt-3'>
                <div class='col'>
                    <a
                        class='cursor-pointer btn w-100'
                        @click='create'
                    >Create</a>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

<script setup>
import { ref } from 'vue';
import {
    TablerModal,
    TablerInput,
} from '@tak-ps/vue-tabler';

defineProps({
    token: {
        type: String,
        required: true
    },
    portal: {
        type: String,
        required: true
    }
});

const emit = defineEmits([
    'create',
    'close'
]);

const data = ref({
    name: ''
});

function create() {
    emit('create', {
        ...data.value
    });
    emit('close');
}

function close() {
    emit('close');
}
</script>
