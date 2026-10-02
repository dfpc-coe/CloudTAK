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
                class='d-flex flex-column gap-2 px-1 pb-5'
            >
                <template
                    v-for='err in list.items'
                    :key='err.id'
                >
                    <StandardItemError
                        :err='err'
                        @click='toggle(err.id)'
                    />
                    <div
                        v-if='expanded === err.id'
                        class='border rounded p-3 mx-1'
                    >
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
                    </div>
                </template>
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
import { ref, watch, onMounted } from 'vue';
import { server } from '../../std.ts';
import type { ErrorReportList } from '../../types.ts';
import TableFooter from '../util/TableFooter.vue';
import StandardItemError from '../CloudTAK/util/StandardItemError.vue';
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

type ErrorSort = 'id' | 'created' | 'updated' | 'username' | 'session_id' | 'message' | 'trace';

const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const expanded = ref<number | undefined>(undefined);

const list = ref<ErrorReportList>({ total: 0, items: [] });
const paging = ref({
    filter: '',
    session_id: '',
    sort: 'created' as ErrorSort,
    order: 'desc' as 'asc' | 'desc',
    limit: 100,
    page: 0
});

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
