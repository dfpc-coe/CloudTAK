<template>
    <TablerModal size='lg'>
        <div class='modal-status bg-blue' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-header text-body'>
            <div class='modal-title'>
                {{ props.board ? "Edit Board" : "New Board" }}
            </div>
        </div>
        <div class='modal-body text-body'>
            <div class='row g-2'>
                <div class='col-12'>
                    <TablerInput
                        v-model='config.name'
                        label='Name'
                        :required='true'
                        @keyup.enter='save'
                    />
                </div>

                <div class='col-12'>
                    <TablerInput
                        v-model='config.description'
                        label='Description'
                        :rows='3'
                    />
                </div>
            </div>

            <div class='d-flex mt-3'>
                <button
                    class='btn btn-secondary'
                    @click='emit("close")'
                >
                    Cancel
                </button>
                <button
                    class='btn btn-primary ms-auto'
                    :disabled='!config.name.trim()'
                    @click='save'
                >
                    Save
                </button>
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import type { CoreEventBoard } from '../../types.ts';
import {
    TablerInput,
    TablerModal,
} from '@tak-ps/vue-tabler';

// No Board creates the modal in "new Board" mode
const props = defineProps<{
    board?: CoreEventBoard;
}>();

const emit = defineEmits<{
    (e: 'save', update: { name: string; description: string }): void;
    (e: 'close'): void;
}>();

const config = ref({
    name: props.board ? props.board.name : '',
    description: props.board ? props.board.description : '',
});

function save(): void {
    if (!config.value.name.trim()) return;

    emit('save', {
        name: config.value.name.trim(),
        description: config.value.description,
    });
}
</script>
