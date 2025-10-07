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
                <div class='col-md-12'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        label='Name Filter'
                        placeholder='Filter...'
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
                label='Imports'
                :create='false'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table card-table table-hover table-vcenter datatable'>
                    <TableHeader
                        v-model:sort='paging.sort'
                        v-model:order='paging.order'
                        v-model:header='header'
                    />
                    <tbody>
                        <tr
                            v-for='imp in list.items'
                            :key='imp.id'
                            tabindex='0'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <div class='d-flex align-items-center'>
                                            <template v-if='h.name === "username"'>
                                                <StatusDot
                                                    :status='imp.status'
                                                />

                                                <div>
                                                    <div v-text='imp[h.name]' />
                                                    <div
                                                        class='subheader'
                                                        v-text='imp.updated'
                                                    />
                                                </div>
                                            </template>
                                            <template v-else-if='h.name == "name"'>
                                                <div class='col-10'>
                                                    <div v-text='imp[h.name]' />
                                                    <div
                                                        class='subheader'
                                                        v-text='imp.id'
                                                    />
                                                </div>
                                                <div class='col-2 d-flex'>
                                                    <div class='ms-auto btn-list'>
                                                        <TablerIconButton
                                                            title='Download File'
                                                            @click='downloadImport(imp.id)'
                                                        >
                                                            <IconDownload
                                                                :size='32'
                                                                stroke='1'
                                                            />
                                                        </TablerIconButton>
                                                    </div>
                                                </div>
                                            </template>
                                            <template v-else>
                                                <span v-text='imp[h.name]' />
                                            </template>
                                        </div>
                                    </td>
                                </template>
                            </template>
                        </tr>
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
import { ref, watch, onMounted } from 'vue';
import { std, stdurl, server } from '../../std.ts';
import type { Import, ImportList } from '../../types.ts';
import StatusDot from '../util/StatusDot.vue';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconDownload
} from '@tabler/icons-vue';

type Header = { name: keyof Import, display: boolean };

const error = ref<Error | undefined>();
const loading = ref(true);
const header = ref<Array<Header>>([]);

const paging = ref({
    filter: '',
    sort: 'created',
    order: 'desc',
    limit: 100,
    page: 0
});

const list = ref<ImportList>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await listImportSchema();
    await fetchList();
});

async function listImportSchema() {
    const schema = await std('/api/schema?method=GET&url=/import');

    const defaults: Array<keyof Import> = ['username', 'name'];
    header.value = defaults.map((h) => {
        return { name: h, display: true };
    });

    // @ts-expect-error Worth trying to type at some point maybe but not now
    header.value.push(...schema.query.properties.sort.enum.map((h) => {
        return {
            name: h,
            display: false
        } as Header
    }).filter((h: Header) => {
        for (const hknown of header.value) {
            if (hknown.name === h.name) return false;
        }
        return true;
    }));
}

async function downloadImport(id: string) {
    const url = stdurl(`/api/import/${id}/raw`)
    url.searchParams.append('token', localStorage.token);
    url.searchParams.append('download', String(true));
    await std(url, {
        download: true
    })
}

async function fetchList() {
    loading.value = true;

    const res = await server.GET('/api/import', {
        params: {
            query: {
                impersonate: true,
                filter: paging.value.filter,
                // @ts-expect-error - Sort should be string list, not string
                sort: paging.value.sort,
                // @ts-expect-error - Order should be string list, not string
                order: paging.value.order,
                limit: paging.value.limit,
                page: paging.value.page,
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    list.value = res.data;

    loading.value = false;
}
</script>
