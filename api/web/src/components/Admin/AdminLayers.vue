<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Layer Admin
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Create Layer Template'
                    @click='router.push("/admin/layer/new")'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

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
                <div class='col-md-6 px-2'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Filter...'
                    />
                </div>
                <div class='col-md-3 px-2'>
                    <TablerEnum
                        v-model='paging.task'
                        default='All Tasks'
                        :options='taskTypes'
                    />
                </div>
                <div class='col-md-3 px-2'>
                    <TablerEnum
                        v-model='paging.template'
                        default='All Types'
                        :options='["All Types", "Connection", "Template"]'
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
                    <tbody
                        role='menu'
                    >
                        <tr
                            v-for='layer in list.items'
                            :key='layer.id'
                            class='cursor-pointer'
                            role='menuitem'
                            tabindex='0'
                            @keyup.enter='external(`/connection/${layer.connection || "template"}/layer/${layer.id}`)'
                            @click='external(`/connection/${layer.connection || "template"}/layer/${layer.id}`)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display && h.name === "name"'>
                                    <td>
                                        <div class='d-flex align-items-center'>
                                            <Status :layer='layer' />
                                            <div class='mx-2 row'>
                                                <div
                                                    class='subheader'
                                                    v-text='layer.parent ? layer.parent.name : "Template Layer"'
                                                />
                                                <div v-text='layer[h.name]' />
                                            </div>
                                        </div>
                                    </td>
                                </template>
                                <template v-else-if='h.display && h.name === "task"'>
                                    <td>
                                        <div class='d-flex align-items-center'>
                                            <div class='row'>
                                                <span
                                                    v-text='layer.task.replace(/\-v\d+\.\d+\.\d+$/, "")'
                                                />
                                                <span
                                                    class='subheader'
                                                    v-text='layer.task.replace(/.*-(?=v\d+\.\d+\.\d+)/, "")'
                                                />
                                            </div>
                                            <div class='mx-2 ms-auto'>
                                                <IconExchange
                                                    v-if='layer.incoming && layer.outgoing'
                                                    title='Outgoing/Incoming'
                                                    size='32'
                                                    stroke='1'
                                                />
                                                <IconStackPop
                                                    v-else-if='layer.outgoing'
                                                    title='Outgoing'
                                                    size='32'
                                                    stroke='1'
                                                />
                                                <IconStackPush
                                                    v-else-if='layer.incoming'
                                                    title='Incoming'
                                                    size='32'
                                                    stroke='1'
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

<script setup lang='ts'>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../std.ts';
import type { ETLLayerList, ETLLayer } from '../../types.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import Status from '../ETL/Layer/utils/StatusDot.vue';
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
    IconPlus,
    IconExchange,
    IconStackPop,
    IconStackPush,
    IconCloudUpload,
} from '@tabler/icons-vue'

const router = useRouter();
const error = ref<Error | undefined>();
const loading = ref(true);

type Header = { name: keyof ETLLayer, display: boolean };
const header = ref<Array<Header>>([]);

const paging = ref({
    filter: '',
    task: 'All Tasks',
    template: 'All Types',
    sort: 'name',
    order: 'asc',
    limit: 100,
    page: 0
});

const list = ref<ETLLayerList>({
    total: 0,
    status: {
        healthy: 0,
        alarm: 0,
        unknown: 0
    },
    tasks: [],
    items: []
});

const taskTypes = computed(() => {
    return ["All Tasks"].concat(list.value.tasks)
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

function external(url: string) {
    window.location.href = url;
}

async function listLayerSchema() {
    const schema = await std('/api/schema?method=GET&url=/layer');

    const defaults: Array<keyof ETLLayer> = ['id', 'name', 'task'];
    header.value = defaults.map((h) => {
        return { name: h, display: true };
    });

    // @ts-expect-error Worth trying to type at some point maybe but not now
    header.value.push(...schema.query.properties.sort.enum.map((h) => {
        return {
            name: h,
            display: false
        }
    }).filter((h: Header) => {
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
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('page', String(paging.value.page));
        url.searchParams.append('sort', paging.value.sort);
        url.searchParams.append('order', paging.value.order);

        if (paging.value.task !== 'All Tasks') {
            url.searchParams.append('task', paging.value.task);
        }

        if (paging.value.template === 'Connection') {
            url.searchParams.append('template', String(false));
        } else if (paging.value.template === 'Template') {
            url.searchParams.append('template', String(true));
        }

        list.value = await std(url) as ETLLayerList;
        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
