<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Data Sync Admin
            </h1>

            <div class='ms-auto btn-list'>
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <TablerInput
                v-model='paging.filter'
                icon='search'
                placeholder='Filter...'
                class='mx-1 my-2'
            />

            <TablerLoading
                v-if='loading'
                desc='Loading Data Syncs'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Layers'
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
                            v-for='data in list.items'
                            :key='data.id'
                            class='cursor-pointer'
                            @click='external(`/connection/${data.connection}/data/${data.id}`)'
                        >
                            <template v-for='h in header' :key='h.name'>
                                <template v-if='h.display'>
                                    <td>
                                        <span v-text='data[h.name]' />
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

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { server, stdclick } from '../../std.ts';
import TableHeader from '../util/TableHeader.vue';
import TableFooter from '../util/TableFooter.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
} from '@tabler/icons-vue';

const err = ref<boolean>(false);
const loading = ref<boolean>(true);
const header = ref<Array<{ name: string; display: boolean }>>([]);
const paging = ref({
    filter: '',
    sort: 'name',
    order: 'asc' as 'asc' | 'desc',
    limit: 100,
    page: 0
});
const list = ref<{ total: number; items: any[] }>({
    total: 0,
    items: []
});

watch(paging, async () => {
    await fetchList();
}, { deep: true });

onMounted(async () => {
    await listDataSchema();
    await fetchList();
});

async function listDataSchema() {
    const res = await server.GET('/api/schema', {
        params: {
            query: {
                method: 'GET',
                url: '/data'
            }
        }
    });

    header.value = ['id', 'name'].map((h) => {
        return { name: h, display: true };
    });

    if ((res.data as any)?.query?.properties?.sort?.enum) {
        header.value.push(...(res.data as any).query.properties.sort.enum.map((h: string) => {
            return {
                name: h,
                display: false
            };
        }).filter((h: any) => {
            for (const hknown of header.value) {
                if (hknown.name === h.name) return false;
            }
            return true;
        }));
    }
}

async function fetchList() {
    loading.value = true;
    
    const res = await server.GET('/api/data' as any, {
        params: {
            query: {
                filter: paging.value.filter,
                sort: paging.value.sort,
                order: paging.value.order,
                limit: paging.value.limit,
                page: paging.value.page
            }
        }
    });

    if (res.data) {
        list.value = {
            total: (res.data as any).total ?? 0,
            items: (res.data as any).items ?? []
        };
    } else {
        list.value = { total: 0, items: [] };
    }
    
    loading.value = false;
}

function external(url: string) {
    window.location.href = url;
}
</script>
