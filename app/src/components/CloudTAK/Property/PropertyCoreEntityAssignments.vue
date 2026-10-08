<template>
    <PropertySection
        label='Assignments'
        :count='assignments.length'
    >
        <template #actions>
            <TablerIconButton
                v-if='props.edit'
                title='Add Assignment'
                @click.stop='addAssignment'
            >
                <IconPlus
                    :size='20'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <TablerLoading
            v-if='loading'
            :compact='true'
            desc='Loading Assignments'
        />
        <template v-else>
            <TablerAlert
                v-if='error'
                :err='error'
            />

            <TablerNone
                v-if='!assignments.length && !creating'
                label='No Assignments'
                class='pb-4'
                :compact='true'
                :create='false'
            />

            <div
                v-for='assignment of assignments'
                :key='assignment.id'
                class='rounded mb-2 px-2 py-2'
                :class='{ "cloudtak-hover-fill": editing !== assignment.id }'
            >
                <template v-if='editing === assignment.id'>
                    <div class='d-flex align-items-center mb-2'>
                        <div class='subheader user-select-none'>
                            Assignment
                        </div>
                        <div class='ms-auto d-flex align-items-center flex-nowrap'>
                            <TablerIconButton
                                title='Save Assignment'
                                :disabled='saving'
                                @click='saveAssignment(assignment.id)'
                            >
                                <IconCheck
                                    :size='18'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <TablerIconButton
                                title='Remove Assignment'
                                :disabled='saving'
                                @click='removeAssignment(assignment.id)'
                            >
                                <IconTrash
                                    :size='18'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>

                    <AssignmentFields v-model='draft' />
                </template>

                <div
                    v-else
                    class='d-flex align-items-center'
                >
                    <IconUser
                        :size='18'
                        stroke='1'
                        class='me-2 flex-shrink-0'
                    />
                    <div
                        class='flex-fill'
                        style='min-width: 0;'
                    >
                        <div class='text-truncate'>
                            <span v-text='assignment.name' />
                            <span
                                v-if='assignment.role'
                                class='text-muted ms-1'
                                v-text='`- ${assignment.role}`'
                            />
                        </div>
                        <div
                            v-if='assignment.uid || assignment.remarks'
                            class='small text-muted text-truncate'
                        >
                            <span
                                v-if='assignment.uid'
                                v-text='assignment.uid'
                            />
                            <span
                                v-if='assignment.uid && assignment.remarks'
                                class='mx-1'
                            >&middot;</span>
                            <span
                                v-if='assignment.remarks'
                                v-text='assignment.remarks'
                            />
                        </div>
                    </div>

                    <TablerIconButton
                        v-if='props.edit'
                        title='Edit Assignment'
                        @click='startEditing(assignment)'
                    >
                        <IconPencil
                            :size='18'
                            stroke='1'
                        />
                    </TablerIconButton>
                </div>
            </div>

            <div
                v-if='creating'
                class='rounded mb-2 px-2 py-2'
            >
                <div class='d-flex align-items-center mb-2'>
                    <div class='subheader user-select-none'>
                        Assignment
                    </div>
                    <div class='ms-auto d-flex align-items-center flex-nowrap'>
                        <TablerIconButton
                            title='Save Assignment'
                            :disabled='saving'
                            @click='saveNewAssignment'
                        >
                            <IconCheck
                                :size='18'
                                stroke='1'
                            />
                        </TablerIconButton>
                        <TablerIconButton
                            title='Discard Assignment'
                            :disabled='saving'
                            @click='cancelNewAssignment'
                        >
                            <IconTrash
                                :size='18'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </div>
                </div>

                <AssignmentFields v-model='draft' />
            </div>
        </template>
    </PropertySection>
</template>

<script setup lang='ts'>
/**
 * PropertyCoreEntityAssignments - the people managing a Core Event in a
 * role (ie: IC, JAG). Each row is its own API resource so edits save
 * immediately rather than through the parent's PATCH
 */

import { ref, watch } from 'vue';
import { server } from '../../../std.ts';
import type { CoreEntityAssignment, CoreEntityAssignmentInput } from '../../../types.ts';
import PropertySection from '../util/PropertySection.vue';
import AssignmentFields from './PropertyCoreEntityAssignmentFields.vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import {
    IconUser,
    IconPlus,
    IconTrash,
    IconPencil,
    IconCheck,
} from '@tabler/icons-vue';

const props = defineProps<{
    /** Core Event to list Assignments for */
    event: string;
    edit?: boolean;
}>();

const loading = ref(true);
const saving = ref(false);
const error = ref<Error | undefined>();
const assignments = ref<Array<CoreEntityAssignment>>([]);

const editing = ref<string | null>(null);
const creating = ref(false);
const draft = ref<CoreEntityAssignmentInput>(emptyDraft());

watch(() => props.event, async () => {
    await listAssignments();
}, { immediate: true });

function emptyDraft(): CoreEntityAssignmentInput {
    return { name: '', uid: '', role: '', remarks: '' };
}

/** The API links a Profile only when a username is given - blank means a person without an account */
function toBody(input: CoreEntityAssignmentInput) {
    return {
        name: input.name.trim(),
        uid: input.uid.trim() || null,
        role: input.role.trim(),
        remarks: input.remarks.trim(),
    };
}

async function listAssignments(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/event/{:event}/assignment', {
            params: {
                path: { ':event': props.event },
                query: {
                    limit: 100,
                    page: 0,
                    order: 'asc',
                    sort: 'created',
                    filter: '',
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        assignments.value = res.data.items;
    } catch (err) {
        assignments.value = [];
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

function addAssignment(): void {
    creating.value = true;
    editing.value = null;
    draft.value = emptyDraft();
}

function startEditing(assignment: CoreEntityAssignment): void {
    creating.value = false;
    editing.value = assignment.id;
    draft.value = {
        name: assignment.name,
        uid: assignment.uid || '',
        role: assignment.role,
        remarks: assignment.remarks,
    };
}

async function saveNewAssignment(): Promise<void> {
    saving.value = true;
    error.value = undefined;

    try {
        const res = await server.POST('/api/core/event/{:event}/assignment', {
            params: { path: { ':event': props.event } },
            body: toBody(draft.value),
        });

        if (res.error) throw new Error(res.error.message);

        assignments.value.push(res.data);
        creating.value = false;
        draft.value = emptyDraft();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    saving.value = false;
}

function cancelNewAssignment(): void {
    creating.value = false;
    draft.value = emptyDraft();
}

async function saveAssignment(id: string): Promise<void> {
    saving.value = true;
    error.value = undefined;

    try {
        const res = await server.PATCH('/api/core/event/{:event}/assignment/{:assignment}', {
            params: { path: { ':event': props.event, ':assignment': id } },
            body: toBody(draft.value),
        });

        if (res.error) throw new Error(res.error.message);

        assignments.value = assignments.value.map((assignment) => {
            return assignment.id === id ? res.data : assignment;
        });
        editing.value = null;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    saving.value = false;
}

async function removeAssignment(id: string): Promise<void> {
    saving.value = true;
    error.value = undefined;

    try {
        const res = await server.DELETE('/api/core/event/{:event}/assignment/{:assignment}', {
            params: { path: { ':event': props.event, ':assignment': id } },
        });

        if (res.error) throw new Error(res.error.message);

        assignments.value = assignments.value.filter((assignment) => assignment.id !== id);
        editing.value = null;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    saving.value = false;
}
</script>
