<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Error Reports
            </h1>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
                <TablerDelete
                    displaytype='icon'
                    match='Delete All Errors'
                    :disabled='!list.items.length'
                    @delete='deleteErrors()'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <div class='mx-1 my-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter by message...'
                />
            </div>

            <div
                v-if='paging.session_id'
                class='mx-1 mb-2'
            >
                <span class='badge bg-blue-lt'>
                    Session: {{ paging.session_id }}
                    <IconX
                        :size='14'
                        stroke='1'
                        class='cursor-pointer ms-1'
                        @click='paging.session_id = ""'
                    />
                </span>
            </div>

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Error Reports'
                :create='false'
            />
            <div
                v-else
                class='table-responsive pb-5'
            >
                <table class='table card-table table-hover table-vcenter datatable'>
                    <TableHeader
                        v-model:sort='paging.sort'
                        v-model:order='paging.order'
                        v-model:header='header'
                    />
                    <tbody role='menu'>
                        <template
                            v-for='err in list.items'
                            :key='err.id'
                        >
                            <tr
                                class='cursor-pointer'
                                role='menuitem'
                                tabindex='0'
                                @keyup.enter='toggle(err.id)'
                                @click='toggle(err.id)'
                            >
                                <template v-for='h in header'>
                                    <td v-if='h.display'>
                                        <span
                                            v-if='h.name === "created" || h.name === "updated"'
                                            v-text='new Date(err[h.name]).toLocaleString()'
                                        />
                                        <span
                                            v-else-if='h.name === "session_id"'
                                            class='text-truncate font-monospace'
                                            v-text='err.session_id || "—"'
                                        />
                                        <span
                                            v-else-if='h.name === "message" || h.name === "trace"'
                                            class='text-truncate d-inline-block'
                                            style='max-width: 40vw;'
                                            v-text='err[h.name] || ""'
                                        />
                                        <span
                                            v-else
                                            v-text='err[h.name as keyof ErrorReport]'
                                        />
                                    </td>
                                </template>
                            </tr>
                            <tr v-if='expanded === err.id'>
                                <td :colspan='shownCount'>
                                    <div class='datagrid mb-3'>
                                        <div class='datagrid-item'>
                                            <div class='datagrid-title'>
                                                Username
                                            </div>
                                            <div class='datagrid-content'>
                                                {{ err.username }}
                                            </div>
                                        </div>
                                        <div class='datagrid-item'>
                                            <div class='datagrid-title'>
                                                Session
                                            </div>
                                            <div class='datagrid-content font-monospace'>
                                                {{ err.session_id || "—" }}
                                            </div>
                                        </div>
                                        <div class='datagrid-item'>
                                            <div class='datagrid-title'>
                                                Created
                                            </div>
                                            <div class='datagrid-content'>
                                                {{ new Date(err.created).toLocaleString() }}
                                            </div>
                                        </div>
                                    </div>

                                    <div class='subheader mb-1'>
                                        Message
                                    </div>
                                    <pre class='border rounded p-2 mb-3'>{{ err.message }}</pre>

                                    <template v-if='err.trace'>
                                        <div class='subheader mb-1'>
                                            Trace
                                        </div>
                                        <pre
                                            class='border rounded p-2 mb-3'
                                            style='max-height: 40vh; overflow: auto;'
                                        >{{ err.trace }}</pre>
                                    </template>

                                    <div class='btn-list justify-content-end'>
                                        <button
                                            v-if='err.session_id'
                                            class='btn btn-outline-secondary'
                                            @click='paging.session_id = err.session_id || ""'
                                        >
                                            Filter to Session
                                        </button>
                                        <TablerDelete
                                            displaytype='button'
                                            label='Delete Log'
                                            @delete='deleteError(err.id)'
                                        />
                                        <TablerDelete
                                            displaytype='button'
                                            label='Delete All From User'
                                            @delete='deleteErrors({ username: err.username })'
                                        />
                                        <TablerDelete
                                            v-if='err.session_id'
                                            displaytype='button'
                                            label='Delete All From Session'
                                            @delete='deleteErrors({ session_id: err.session_id || undefined })'
                                        />
                                    </div>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
            <div
                class='position-absolute bottom-0 w-100'
                style='height: 61px;'
            >
                <TableFooter
                    :limit='paging.limit'
                    :total='list.total'
                    @page='paging.page = $event'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, computed, onMounted } from 'vue';
import { server } from '../../std.ts';
import type { ErrorReport, ErrorReportList } from '../../types.ts';
import TableHeader from '../util/TableHeader.vue';
import TableFooter from '../util/TableFooter.vue';
import {
    IconX,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerDelete,
    TablerLoading,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';

type Header = { name: string, display: boolean };
type ErrorSort = 'id' | 'created' | 'updated' | 'username' | 'session_id' | 'message' | 'trace';

const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const expanded = ref<number | undefined>(undefined);

const header = ref<Array<Header>>([
    { name: 'created', display: true },
    { name: 'username', display: true },
    { name: 'session_id', display: true },
    { name: 'message', display: true },
    { name: 'id', display: false },
    { name: 'updated', display: false },
    { name: 'trace', display: false },
]);

const list = ref<ErrorReportList>({ total: 0, items: [] });
const paging = ref({
    filter: '',
    session_id: '',
    sort: 'created' as ErrorSort,
    order: 'desc' as 'asc' | 'desc',
    limit: 100,
    page: 0
});

const shownCount = computed(() => header.value.filter((h) => h.display).length);

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

function toggle(id: number): void {
    expanded.value = expanded.value === id ? undefined : id;
}

async function fetchList(): Promise<void> {
    try {
        loading.value = true;
        const res = await server.GET('/api/error', {
            params: {
                query: {
                    filter: paging.value.filter,
                    session_id: paging.value.session_id || undefined,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: paging.value.sort,
                    order: paging.value.order
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        list.value = res.data as ErrorReportList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

async function deleteError(errorid: number): Promise<void> {
    try {
        loading.value = true;
        const res = await server.DELETE('/api/error/{:errorid}', {
            params: {
                path: {
                    ':errorid': errorid
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        expanded.value = undefined;
        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}

async function deleteErrors(query: { username?: string, session_id?: string } = {}): Promise<void> {
    try {
        loading.value = true;
        const res = await server.DELETE('/api/error', {
            params: {
                query: {
                    username: query.username || undefined,
                    session_id: query.session_id || undefined,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        expanded.value = undefined;
        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>
