<template>
    <div class='h-full w-full cloudtak-page d-flex flex-column forms-page'>
        <NavHeader>
            <template #left>
                <TablerIconButton
                    v-if='mode === "editor"'
                    title='Back to Forms'
                    @click='closeEditor'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <div
                    class='fs-3 fw-bold user-select-none'
                    v-text='title'
                />
            </template>

            <template v-if='mode === "list"'>
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
            </template>
        </NavHeader>

        <div
            v-if='mode === "editor"'
            class='flex-grow-1 overflow-auto'
        >
            <div class='forms-editor px-3 py-3'>
                <FormEditor
                    :form='editForm'
                    @saved='onSaved'
                    @cancel='closeEditor'
                />
            </div>
        </div>
        <div
            v-else
            class='flex-grow-1 d-flex flex-column overflow-hidden'
        >
            <div class='px-3 py-2'>
                <TablerInput
                    v-model='paging.filter'
                    placeholder='Search Forms...'
                    icon='search'
                />
            </div>

            <div class='flex-grow-1 overflow-auto'>
                <div
                    v-if='loading'
                    class='d-flex align-items-center justify-content-center h-100'
                >
                    <TablerLoading desc='Loading Forms' />
                </div>
                <div
                    v-else-if='error'
                    class='d-flex align-items-center justify-content-center h-100'
                >
                    <TablerAlert
                        title='Forms Error'
                        :err='error'
                    />
                </div>
                <div
                    v-else-if='!list.items.length'
                    class='d-flex align-items-center justify-content-center h-100'
                >
                    <TablerNone
                        :label='paging.filter ? "No Matching Forms" : "No Forms"'
                        :create='false'
                    />
                </div>
                <table
                    v-else
                    class='table table-hover table-vcenter forms-list'
                >
                    <thead>
                        <tr>
                            <th>Form</th>
                            <th class='d-none d-md-table-cell'>
                                Shared With
                            </th>
                            <th class='d-none d-lg-table-cell'>
                                Author
                            </th>
                            <th class='forms-list-date'>
                                Updated
                            </th>
                            <th class='forms-list-actions' />
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='form in list.items'
                            :key='form.id'
                            :class='{ "cursor-pointer": isEditable(form) }'
                            @click='isEditable(form) && openEdit(form)'
                        >
                            <td>
                                <div class='d-flex align-items-center gap-2'>
                                    <IconForms
                                        :size='18'
                                        stroke='1.5'
                                        class='flex-shrink-0 text-secondary'
                                    />
                                    <div style='min-width: 0;'>
                                        <div
                                            class='text-truncate forms-list-name'
                                            v-text='form.name'
                                        />
                                        <div
                                            v-if='form.description'
                                            class='small text-secondary text-truncate forms-list-name'
                                            v-text='form.description'
                                        />
                                    </div>
                                </div>
                            </td>
                            <td class='d-none d-md-table-cell'>
                                <div
                                    v-if='form.channels.length'
                                    class='d-flex flex-nowrap gap-1'
                                    :title='form.channels.map(channelName).join(", ")'
                                >
                                    <span
                                        class='badge bg-blue-lt text-truncate'
                                        v-text='channelName(form.channels[0])'
                                    />
                                    <span
                                        v-if='form.channels.length > 1'
                                        class='badge bg-secondary-lt flex-shrink-0'
                                        v-text='`+ ${form.channels.length - 1} channel${form.channels.length > 2 ? "s" : ""}`'
                                    />
                                </div>
                                <span
                                    v-else
                                    class='text-secondary'
                                >Not Shared</span>
                            </td>
                            <td
                                class='d-none d-lg-table-cell'
                                v-text='form.username || "Unknown"'
                            />
                            <td>
                                <div v-text='timeDiff(form.updated)' />
                                <div
                                    class='subheader'
                                    v-text='form.updated'
                                />
                            </td>
                            <td>
                                <div
                                    v-if='isEditable(form)'
                                    class='btn-list flex-nowrap justify-content-end'
                                    @click.stop
                                >
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
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div
                v-if='!loading && !error && list.total > paging.limit'
                class='border-top'
            >
                <TableFooter
                    :limit='paging.limit'
                    :total='list.total'
                    :page='paging.page'
                    @page='paging.page = $event'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
/**
 * Forms - standalone page for managing the Core Forms that Events and Board
 * Columns use. Lists every Form visible to the user (authored or shared via
 * one of their Channels) and hands creation & editing to FormEditor - only
 * the author or a System Admin can edit or delete a Form.
 */

import { ref, computed, watch, onMounted } from 'vue';
import { server } from '../../std.ts';
import timeDiff from '../../timediff.ts';
import type { CoreForm, CoreFormList } from '../../types.ts';
import GroupManager from '../../base/group.ts';
import ProfileConfig from '../../base/profile.ts';
import NavHeader from '../util/NavHeader.vue';
import TableFooter from '../util/TableFooter.vue';
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
    TablerDelete,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';

const mode = ref<'list' | 'editor'>('list');
const editForm = ref<CoreForm | undefined>();

const loading = ref(true);
const error = ref<Error | undefined>();
const list = ref<CoreFormList>({ total: 0, items: [] });
const paging = ref({
    filter: '',
    sort: 'name' as 'name' | 'created' | 'updated',
    order: 'asc' as 'asc' | 'desc',
    limit: 50,
    page: 0,
});

const profile = ref<{ username?: string; system_admin?: boolean }>({});
const channels = ref<Map<number, string>>(new Map());

const title = computed<string>(() => {
    if (mode.value === 'list') return 'Forms';
    return editForm.value ? 'Edit Form' : 'New Form';
});

watch(() => paging.value.filter, () => {
    if (paging.value.page !== 0) paging.value.page = 0;
});

watch(paging.value, async () => {
    await listForms();
});

onMounted(async () => {
    // Standalone pages have no locally synced Profile - the API is the source
    // for the author/admin checks that gate editing
    try {
        const [fetched, groups] = await Promise.all([
            ProfileConfig.fetch(),
            GroupManager.list(),
        ]);

        profile.value = {
            username: fetched.username,
            system_admin: fetched.system_admin,
        };

        channels.value = new Map(groups.map((group) => [group.bitpos, group.name]));
    } catch (err) {
        console.error('Failed to load Profile or Channels', err);
    }

    await listForms();
});

function channelName(bitpos: number): string {
    return channels.value.get(bitpos) || `Channel ${bitpos}`;
}

function isEditable(form: CoreForm): boolean {
    return !!profile.value.system_admin
        || (!!form.username && form.username === profile.value.username);
}

async function listForms(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/core/form', {
            params: {
                query: {
                    filter: paging.value.filter,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: paging.value.sort,
                    order: paging.value.order,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
    } catch (err) {
        list.value = { total: 0, items: [] };
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

function closeEditor(): void {
    mode.value = 'list';
    editForm.value = undefined;
}

async function onSaved(): Promise<void> {
    closeEditor();
    await listForms();
}

async function deleteForm(form: CoreForm): Promise<void> {
    error.value = undefined;

    try {
        const res = await server.DELETE('/api/core/form/{:form}', {
            params: { path: { ':form': form.id } }
        });

        if (res.error) throw new Error(res.error.message);

        await listForms();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

<style>
.forms-page .forms-editor {
    max-width: 900px;
    margin: 0 auto;
}

.forms-page .forms-list thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--tblr-bg-surface);
}

.forms-page .forms-list-name {
    max-width: 400px;
}

.forms-page .forms-list-date {
    min-width: 170px;
}

.forms-page .forms-list-actions {
    width: 90px;
}
</style>
