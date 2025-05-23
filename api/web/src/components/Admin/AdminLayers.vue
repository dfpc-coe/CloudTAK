<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Layer Admin
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Redeploy'
                    @click='redeploy'
                >
                    <IconCloudUpload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <div class='row g-0 py-2'>
                <div class='col-md-8 px-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter...'
                    />
                </div>
                <div class='col-md-4 px-2'>
                    <TablerEnum
                        v-model='paging.task'
                        default='All Types'
                        :options='taskTypes'
                    />
                </div>
            </div>

            <TablerLoading
                v-if='loading'
                desc='Loading Layers'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Layers'
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
                            v-for='layer in list.items'
                            :key='layer.id'
                            class='cursor-pointer'
                            @click='stdclick(router, $event, `/connection/${layer.connection}/layer/${layer.id}`)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display && h.name === "name"'>
                                    <td>
                                        <div class='d-flex align-items-center'>
                                            <Status :layer='layer' />
                                            <div class='mx-2 row'>
                                                <div
                                                    class='subheader'
                                                    v-text='layer.parent.name'
                                                />
                                                <div v-text='layer[h.name]' />
                                            </div>
                                        </div>
                                    </td>
                                </template>
                                <template v-else-if='h.display && h.name === "task"'>
                                    <td>
                                        <div class='d-flex align-items-center'>
                                            <span v-text='layer.task' />
                                            <div class='mx-2 ms-auto'>
                                                <IconExchange
                                                    v-if='layer.incoming && layer.outgoing'
                                                    title='Outgoing/Incoming'
                                                    size='32'
                                                    :stroke='1'
                                                />
                                                <IconStackPop
                                                    v-else-if='layer.outgoing'
                                                    title='Outgoing'
                                                    size='32'
                                                    :stroke='1'
                                                />
                                                <IconStackPush
                                                    v-else-if='layer.incoming'
                                                    title='Incoming'
                                                    size='32'
                                                    :stroke='1'
                                                />
                                            </div>
                                        </div>
                                    </td>
                                </template>
                                <template v-else-if='h.display'>
                                    <td>
                                        <span v-text='layer[h.name]' />
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

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router';
import { std, stdurl, stdclick } from '../../std.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import Status from '../Layer/utils/StatusDot.vue';
import {
    TablerNone,
    TablerInput,
    TablerEnum,
    TablerLoading,
    TablerAlert,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconExchange,
    IconStackPop,
    IconStackPush,
    IconCloudUpload,
} from '@tabler/icons-vue'

const router = useRouter();
const error = ref(false);
const loading = ref(true);
const header = ref([]);
const paging = ref({
    filter: '',
    task: 'All Types',
    sort: 'name',
    order: 'asc',
    limit: 100,
    page: 0
});
const list = ref({
    total: 0,
    tasks: [],
    items: []
});

const taskTypes = computed(() => {
    return ["All Types"].concat(list.value.tasks)
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await listLayerSchema();
    await fetchList();
});

async function redeploy() {
    loading.value = true;
    await std(`/api/layer/redeploy`, {
        method: 'POST'
    });
    loading.value = false;
}

async function listLayerSchema() {
    const schema = await std('/api/schema?method=GET&url=/layer');
    header.value = ['id', 'name', 'task'].map((h) => {
        return { name: h, display: true };
    });

    header.value.push(...schema.query.properties.sort.enum.map((h) => {
        return {
            name: h,
            display: false
        }
    }).filter((h) => {
        for (const hknown of header.value) {
            if (hknown.name === h.name) return false;
        }
        return true;
    }));
}

async function fetchList() {
    loading.value = true;
    error.value = undefined;

    try {
        const url = stdurl('/api/layer');
        url.searchParams.append('alarms', 'true');
        url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('limit', paging.value.limit);
        url.searchParams.append('sort', paging.value.sort);
        url.searchParams.append('order', paging.value.order);
        url.searchParams.append('page', paging.value.page);

        if (paging.value.task !== 'All Types') {
            url.searchParams.append('task', paging.value.task);
        }

        list.value = await std(url);
        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
