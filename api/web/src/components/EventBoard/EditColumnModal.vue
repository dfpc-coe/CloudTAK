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
                Edit Column
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
                    {{ config.name.trim() || "Column Name" }}
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

                <div class='col-12'>
                    <label class='form-label'>Forms</label>
                    <TablerLoading
                        v-if='formsLoading'
                        :compact='true'
                        desc='Loading Forms'
                    />
                    <TablerAlert
                        v-else-if='formsError'
                        :err='formsError'
                    />
                    <template v-else>
                        <div class='d-flex align-items-end gap-2'>
                            <FormSelect
                                ref='formSelect'
                                v-model='forms'
                                :channel='props.channel'
                                class='flex-grow-1'
                            />
                            <TablerIconButton
                                title='Manage Forms'
                                @click='manageForms = true'
                            >
                                <IconSettings
                                    :size='24'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                        <div class='form-hint mt-1'>
                            Required Forms must be completed for Events placed in this Column
                        </div>
                    </template>
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

        <FormManager
            v-if='manageForms'
            :channel='props.channel'
            @close='closeManager'
            @saved='onFormSaved'
            @deleted='onFormDeleted'
        />
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { server } from '../../std.ts';
import type { CoreForm, CoreEventBoardColumn } from '../../types.ts';
import FormSelect from '../CloudTAK/util/FormSelect.vue';
import type { FormAttachment } from '../CloudTAK/util/FormSelect.vue';
import FormManager from '../Forms/FormManager.vue';
import { IconCheck, IconSettings } from '@tabler/icons-vue';
import {
    TablerAlert,
    TablerBadge,
    TablerInput,
    TablerModal,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    column: CoreEventBoardColumn;
    /** TAK Channel bitpos of the Column's Board - scopes the attachable Forms */
    channel?: number;
}>();

const emit = defineEmits<{
    (e: 'save', update: {
        name: string;
        description: string;
        color: string;
        /** Omitted when the attached Forms could not be loaded - the existing attachments are then left untouched */
        forms?: Array<{ form: string; required: boolean }>;
    }): void;
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
    name: props.column.name,
    description: props.column.description,
    color: props.column.color,
});

const forms = ref<Array<FormAttachment>>([]);
const formsLoading = ref(true);
const formsError = ref<Error | undefined>();

const manageForms = ref(false);
const formSelect = ref<InstanceType<typeof FormSelect> | null>(null);

/** An edit in the manager reflects onto the already staged attachment rows */
function onFormSaved(form: CoreForm): void {
    forms.value = forms.value.map((attachment) => {
        return attachment.form.id === form.id
            ? { ...attachment, form }
            : attachment;
    });
}

/** A deleted Form can no longer be attached - drop it from the staged rows */
function onFormDeleted(id: string): void {
    forms.value = forms.value.filter((attachment) => attachment.form.id !== id);
}

async function closeManager(): Promise<void> {
    manageForms.value = false;

    await formSelect.value?.refresh();
}

onMounted(async () => {
    try {
        const res = await server.GET('/api/board/column/{:column}/form', {
            params: { path: { ':column': props.column.id } }
        });

        if (res.error) throw new Error(res.error.message);

        forms.value = res.data.items.map((attachment) => {
            return { form: attachment.form, required: attachment.required };
        });
    } catch (err) {
        formsError.value = err instanceof Error ? err : new Error(String(err));
    }

    formsLoading.value = false;
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
        ...(formsLoading.value || formsError.value ? {} : {
            forms: forms.value.map((attachment) => {
                return { form: attachment.form.id, required: attachment.required };
            }),
        }),
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
