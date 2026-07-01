<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                User Imports
            </h1>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <div class='row col-12 mx-1 my-2'>
                <div class='col-md-9 col-lg-9'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        label='Name Filter'
                        placeholder='Filter...'
                    />
                </div>
                <div class='col-md-3 col-lg-3'>
                    <TablerEnum
                        v-model='paging.status'
                        label='Status'
                        :options='statusOptions'
                        default='All Statuses'
                    />
                </div>
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Imports'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Imports'
                :create='false'
            />
            <div
                v-else
                class='d-flex flex-column gap-2 px-1 pb-5'
            >
                <template
                    v-for='imp in list.items'
                    :key='imp.id'
                >
                    <StandardItemImport
                        :imp='imp'
                        :show-username='true'
                        :button-retry='true'
                        :button-download='true'
                        @click='toggle(imp.id)'
                        @retry='retryImport(imp.id)'
                        @download='downloadImport(imp.id)'
                    />
                    <div
                        v-if='expanded === imp.id'
                        class='border rounded p-3 mx-1'
                    >
                        <div class='datagrid mb-3'>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Username
                                </div>
                                <div class='datagrid-content'>
                                    {{ imp.username }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Status
                                </div>
                                <div class='datagrid-content'>
                                    {{ imp.status }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Source
                                </div>
                                <div class='datagrid-content'>
                                    {{ imp.source }}{{ imp.source_id ? `: ${imp.source_id}` : '' }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Created
                                </div>
                                <div class='datagrid-content'>
                                    {{ new Date(imp.created).toLocaleString() }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Updated
                                </div>
                                <div class='datagrid-content'>
                                    {{ new Date(imp.updated).toLocaleString() }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    ID
                                </div>
                                <div class='datagrid-content font-monospace small'>
                                    {{ imp.id }}
                                </div>
                            </div>
                        </div>

                        <template v-if='imp.error'>
                            <div class='subheader mb-1'>
                                Error
                            </div>
                            <pre
                                class='border rounded p-2 mb-3'
                                style='max-height: 30vh; overflow: auto;'
                            >{{ imp.error }}</pre>
                        </template>

                        <div class='btn-list justify-content-end'>
                            <TablerIconButton
                                v-if='imp.status === "Fail"'
                                title='Retry Import'
                                @click='retryImport(imp.id)'
                            >
                                <IconRestore
                                    :size='20'
                                    stroke='1'
                                />
                            </TablerIconButton>
                            <button
                                class='btn btn-outline-secondary'
                                @click='downloadImport(imp.id)'
                            >
                                <IconDownload
                                    :size='16'
                                    stroke='1'
                                    class='me-1'
                                />
                                Download
                            </button>
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
import { stdurl, server, downloadUrl } from '../../std.ts';
import type { paths } from '@cloudtak/api-types';
import type { ImportList } from '../../types.ts';
import TableFooter from '../util/TableFooter.vue';
import StandardItemImport from '../CloudTAK/util/StandardItemImport.vue';
import {
    TablerNone,
    TablerInput,
    TablerEnum,
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRestore,
    IconDownload
} from '@tabler/icons-vue';

const error = ref<Error | undefined>();
const loading = ref(true);
const expanded = ref<string | undefined>(undefined);

const paging = ref({
    filter: '',
    status: 'All',
    sort: 'created',
    order: 'desc',
    limit: 100,
    page: 0
});

const statusOptions = [
    'All',
    'Empty',
    'Pending',
    'Running',
    'Success',
    'Fail'
];

const list = ref<ImportList>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

function toggle(id: string): void {
    expanded.value = expanded.value === id ? undefined : id;
}

async function retryImport(id: string) {
    try {
        const res = await server.POST('/api/import/{:import}/retry', {
            params: { path: { ':import': id } },
        });
        if (res.error) throw new Error(res.error.message);
        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function downloadImport(id: string) {
    const url = stdurl(`/api/import/${id}/raw`);
    url.searchParams.set('download', 'true');
    await downloadUrl(url, { token: true });
}

async function fetchList() {
    loading.value = true;
    error.value = undefined;

    try {
        const params: paths['/api/import']['get']['parameters']['query'] = {
            impersonate: true,
            filter: paging.value.filter,
            sort: paging.value.sort as paths['/api/import']['get']['parameters']['query']['sort'],
            order: paging.value.order as "asc" | "desc",
            limit: paging.value.limit,
            page: paging.value.page,
        };

        // Only add status filter if it's not 'All'
        if (paging.value.status && paging.value.status !== 'All') {
            params.status = paging.value.status as paths['/api/import']['get']['parameters']['query']['status'];
        }

        const res = await server.GET('/api/import', {
            params: {
                query: params
            }
        });

        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}
</script>
