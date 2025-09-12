<template>
    <TablerModal>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-header'>
            <span class='modal-title'>Edit Link</span>
        </div>
        <div class='modal-body py-4'>
            <StyleTemplate
                v-model='link.remarks'
                label='Link Name'
                :schema='props.schema'
                class='py-1'
            />
            <StyleTemplate
                v-model='link.url'
                label='Link URL'
                :schema='props.schema'
                class='py-1'
            />

            <button
                v-if='props.edit'
                class='btn btn-primary w-100 mt-4'
                @click='done'
            >
                Update
            </button>
            <button
                v-else
                class='btn btn-primary w-100 mt-4'
                @click='done'
            >
                Create
            </button>
        </div>
    </TablerModal>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import StyleTemplate from './StyleTemplate.vue';
import {
    TablerModal,
} from '@tak-ps/vue-tabler';

const props = defineProps({
    edit: {
        type: Object,
    },
    schema: {
        type: Object,
        required: true
    }
});

const emit = defineEmits([
    'close',
    'done'
]);

const link = ref({
    remarks: '',
    url: '',
});

onMounted(() => {
    if (props.edit) {
        link.value = Object.assign(link.value, JSON.parse(JSON.stringify(props.edit)));
    }
});

function done() {
    emit('done', link.value);
}
</script>

