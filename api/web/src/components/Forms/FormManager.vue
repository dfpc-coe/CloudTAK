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
            <div class='modal-title d-flex align-items-center gap-2'>
                <TablerIconButton
                    v-if='mode === "editor"'
                    title='Back to Forms'
                    @click='mode = "list"'
                >
                    <IconCircleArrowLeft
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
                <IconForms
                    v-else
                    :size='24'
                    stroke='1.5'
                />
                <span v-text='title' />
            </div>
            <div
                v-if='mode === "list"'
                class='ms-auto btn-list'
            >
                <TablerIconButton
                    title='New Form'
                    @click='openCreate'
                >
                    <IconPlus
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerIconButton
                    title='Refresh Forms'
                    @click='listForms'
                >
                    <IconRefresh
                        :size='24'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>
        </div>
        <div class='modal-body text-body form-manager-body'>
            <FormEditor
                v-if='mode === "editor"'
                :form='editForm'
                :channel='props.channel'
                @saved='onSaved'
                @cancel='mode = "list"'
            />
            <template v-else>
                <TablerInput
                    v-model='search'
                    placeholder='Search...'
                    icon='search'
                    class='mb-2'
                />

                <TablerLoading
                    v-if='loading'
                    desc='Loading Forms'
                />
                <TablerAlert
                    v-else-if='error'
                    :err='error'
                />
                <template v-else>
                    <div
                        v-if='filtered.length'
                        class='rounded border'
                    >
                        <div
                            v-for='form of filtered'
                            :key='form.id'
                            class='d-flex align-items-center gap-2 px-2 py-2 form-manager-row'
                        >
                            <IconForms
                                :size='18'
                                stroke='1.5'
                                class='flex-shrink-0 text-secondary'
                            />
                            <div
                                class='flex-grow-1'
                                style='min-width: 0;'
                            >
                                <div
                                    class='text-truncate'
                                    v-text='form.name'
                                />
                                <div
                                    v-if='form.description'
                                    class='small text-secondary text-truncate'
                                    v-text='form.description'
                                />
                            </div>
                            <TablerIconButton
                                title='Edit Form'
                                @click='openEdit(form)'
                            >
                                <IconPencil
                                    :size='18'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerDelete
                                displaytype='icon'
                                :size='18'
                                label='Delete Form'
                                title='Delete Form'
                                @delete='deleteForm(form)'
                            />
                        </div>
                    </div>
                    <TablerNone
                        v-else
                        :compact='true'
                        :create='false'
                        :label='forms.length ? "No Matching Forms" : "No Forms"'
                    />
                </template>
            </template>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
/**
 * FormManager - modal for managing Core Forms: create, edit & delete, with
 * the schema built via FormEditor's TablerSchemaBuilder. Surfaced from the
 * Board Column editor beside the Form selection dropdown; `saved`/`deleted`
 * let that parent keep its staged attachment list in sync.
 */

import { ref, computed } from 'vue';
import { server } from '../../std.ts';
import type { CoreForm } from '../../types.ts';
import FormEditor from './FormEditor.vue';
import {
    IconPlus,
    IconForms,
    IconPencil,
    IconRefresh,
    IconCircleArrowLeft,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerModal,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    /** TAK Channel bitpos preselected for sharing on newly created Forms */
    channel?: number;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    /** A Form was created or updated */
    (e: 'saved', form: CoreForm): void;
    /** A Form was deleted */
    (e: 'deleted', id: string): void;
}>();

const mode = ref<'list' | 'editor'>('list');
const editForm = ref<CoreForm | undefined>();

const search = ref('');
const loading = ref(true);
const error = ref<Error | undefined>();
const forms = ref<Array<CoreForm>>([]);

const title = computed<string>(() => {
    if (mode.value === 'list') return 'Manage Forms';
    return editForm.value ? 'Edit Form' : 'New Form';
});

const filtered = computed<Array<CoreForm>>(() => {
    const term = search.value.trim().toLowerCase();

    if (!term) return forms.value;

    return forms.value.filter((form) => {
        return form.name.toLowerCase().includes(term)
            || form.description.toLowerCase().includes(term);
    });
});

void listForms();

async function listForms(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/form', {
            params: {
                query: {
                    limit: 100,
                    page: 0,
                    order: 'asc',
                    sort: 'name',
                    filter: '',
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        forms.value = res.data.items;
    } catch (err) {
        forms.value = [];
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

function openCreate(): void {
    editForm.value = undefined;
    mode.value = 'editor';
}

function openEdit(form: CoreForm): void {
    editForm.value = form;
    mode.value = 'editor';
}

async function onSaved(form: CoreForm): Promise<void> {
    mode.value = 'list';
    editForm.value = undefined;

    emit('saved', form);

    await listForms();
}

async function deleteForm(form: CoreForm): Promise<void> {
    error.value = undefined;

    try {
        const res = await server.DELETE('/api/core/form/{:form}', {
            params: { path: { ':form': form.id } }
        });

        if (res.error) throw new Error(res.error.message);

        emit('deleted', form.id);

        await listForms();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

<style>
.form-manager-body {
    max-height: calc(100dvh - 12rem);
    overflow-y: auto;
}

.form-manager-row + .form-manager-row {
    border-top: var(--tblr-border-width) solid var(--tblr-border-color);
}
</style>
