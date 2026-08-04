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
                Edit Board
            </div>
        </div>
        <div class='modal-body text-body'>
            <div class='d-flex align-items-center justify-content-center rounded py-4 mb-3 event-board-edit-preview'>
                <TablerBadge
                    class='text-truncate'
                    :background-color='previewBase + "26"'
                    :border-color='previewBase + "59"'
                    :text-color='previewBase'
                >
                    {{ config.name.trim() || "Board Name" }}
                </TablerBadge>
            </div>

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
                    <label class='form-label'>Color</label>
                    <div class='d-flex align-items-center flex-wrap gap-2'>
                        <button
                            v-for='swatch in palette'
                            :key='swatch.hex'
                            type='button'
                            class='event-board-swatch'
                            :style='swatchStyle(swatch)'
                            :title='swatch.label'
                            :aria-pressed='config.color === swatch.hex'
                            @click='config.color = swatch.hex'
                        >
                            <IconCheck
                                v-if='config.color === swatch.hex'
                                :size='16'
                                stroke='3'
                            />
                        </button>
                    </div>
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
import { ref, computed } from 'vue';
import type { CoreEventBoard } from '../../types.ts';
import { IconCheck } from '@tabler/icons-vue';
import {
    TablerBadge,
    TablerInput,
    TablerModal,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    board: CoreEventBoard;
}>();

const emit = defineEmits<{
    (e: 'save', update: { name: string; description: string; color: string }): void;
    (e: 'close'): void;
}>();

/** Tabler theme colours - an empty hex is the unstyled default */
const palette = [
    { label: 'Default', hex: '' },
    { label: 'Gray', hex: '#667382' },
    { label: 'Blue', hex: '#206bc4' },
    { label: 'Green', hex: '#2fb344' },
    { label: 'Yellow', hex: '#f59f00' },
    { label: 'Orange', hex: '#f76707' },
    { label: 'Red', hex: '#d63939' },
    { label: 'Pink', hex: '#d6336c' },
    { label: 'Purple', hex: '#ae3ec9' },
];

const config = ref({
    name: props.board.name,
    description: props.board.description,
    color: props.board.color,
});

const previewBase = computed(() => {
    return config.value.color || '#667382';
});

function swatchStyle(swatch: { label: string; hex: string }): Record<string, string> {
    const base = swatch.hex || '#667382';

    if (config.value.color === swatch.hex) {
        return {
            color: '#ffffff',
            borderColor: base,
            backgroundColor: base,
        };
    }

    return {
        color: base,
        borderColor: base + '80',
        backgroundColor: base + '26',
    };
}

function save(): void {
    if (!config.value.name.trim()) return;

    emit('save', {
        name: config.value.name.trim(),
        description: config.value.description,
        color: config.value.color,
    });
}
</script>

<style>
.event-board-edit-preview {
    background-color: rgba(0, 0, 0, 0.2);
}

[data-bs-theme='light'] .event-board-edit-preview {
    background-color: rgba(0, 0, 0, 0.05);
}

.event-board-swatch {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 1px solid;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
</style>
