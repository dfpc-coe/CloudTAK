<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Registered Tasks
            </h1>

            <div class='ms-auto btn-list'>
                <template v-if='!edit'>
                    <TablerIconButton
                        title='Register New Task'
                        @click='edit = {
                            "name": "",
                            "prefix": "",
                            "readme": "",
                            "repo": ""
                        }'
                    >
                        <IconPlus
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerRefreshButton
                        title='Refresh'
                        :loading='loading'
                        @click='fetchList'
                    />
                </template>
                <template v-else-if='edit.id'>
                    <TablerDelete
                        displaytype='icon'
                        @delete='deleteTask(edit)'
                    />
                </template>
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <template v-if='edit'>
                <TablerLoading
                    v-if='loading'
                    desc='Saving Tasks'
                />
                <template v-else>
                    <div class='row g-2 py-2 px-2'>
                        <div class='col-md-6 col-12'>
                            <TablerInput
                                v-model='edit.name'
                                label='Task Name'
                            />
                        </div>
                        <div class='col-md-6 col-12'>
                            <TablerInput
                                v-model='edit.prefix'
                                :disabled='edit.id'
                                label='Container Prefix'
                            />
                        </div>
                        <div class='col-12'>
                            <TablerToggle
                                v-model='edit.favorite'
                                label='Favorited'
                            />
                        </div>

                        <UploadLogo
                            v-model='edit.logo'
                            label='Task Logo'
                        />
                        <TablerInput
                            v-model='edit.repo'
                            label='Task Code Repository URL'
                        />

                        <TablerInput
                            v-model='edit.readme'
                            label='Task Markdown Readme URL'
                        />

                        <div class='col-12 d-flex py-2'>
                            <button
                                class='btn btn-secondary'
                                @click='edit = false'
                            >
                                Cancel
                            </button>
                            <div class='ms-auto btn-list mx-3'>
                                <button
                                    class='btn btn-primary'
                                    @click='saveTask'
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </template>
            </template>
            <template v-else>
                <TablerLoading
                    v-if='loading'
                    desc='Loading Tasks'
                />
                <TablerAlert
                    v-else-if='error'
                    :err='error'
                />
                <TablerNone
                    v-else-if='!list.items.length'
                    label='No Tasks'
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
                                @click='edit = layer'
                            >
                                <template v-for='h in header'>
                                    <template v-if='h.display'>
                                        <td>
                                            <template v-if='h.name === "logo"'>
                                                <img
                                                    v-if='layer[h.name]'
                                                    :src='layer[h.name]'
                                                    alt='Logo Preview'
                                                    class='img-thumbnail'
                                                    style='height: 50px;'
                                                >
                                                <span v-else>No Logo</span>
                                            </template>
                                            <template v-else-if='h.name === "name"'>
                                                <div class='d-flex align-items-center'>
                                                    <IconStar
                                                        v-if='layer.favorite'
                                                    />
                                                    <span
                                                        class='ms-2'
                                                        v-text='layer[h.name]'
                                                    />
                                                </div>
                                            </template>
                                            <template v-else>
                                                <span v-text='layer[h.name]' />
                                            </template>
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
            </template>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { std, stdurl } from '/src/std.ts';
import TableHeader from '../../util/TableHeader.vue'
import TableFooter from '../../util/TableFooter.vue'
import UploadLogo from '../../util/UploadLogo.vue';
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerToggle,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
    TablerDelete
} from '@tak-ps/vue-tabler';
import {
    IconStar,
    IconPlus,
} from '@tabler/icons-vue'

const error = ref();
const loading = ref(true);
const header = ref([]);
const edit = ref();
const paging = ref({
    filter: '',
    sort: 'name',
    order: 'asc',
    limit: 100,
    page: 0
});
const list = ref({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await listLayerSchema();
    await fetchList();
});

async function listLayerSchema() {
    const schema = await std('/api/schema?method=GET&url=/task');
    header.value = ['logo', 'name', 'prefix'].map((h) => {
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

async function saveTask() {
    loading.value = true;

    if (edit.value.id) {
        await std(`/api/task/${edit.value.id}`, {
            method: 'PATCH',
            body: edit.value
        });
    } else {
        await std('/api/task', {
            method: 'POST',
            body: edit.value
        });
    }

    edit.value = false

    await fetchList();
}

async function deleteTask(task) {
    loading.value = true;
    const url = stdurl(`/api/task/${task.id}`);
    await std(url, {
        method: 'DELETE'
    });

    edit.value = undefined;
    await fetchList();

    loading.value = false;
}

async function fetchList() {
    loading.value = true;
    const url = stdurl('/api/task');
    if (paging.value.filter) url.searchParams.append('filter', paging.value.filter);
    url.searchParams.append('limit', paging.value.limit);
    url.searchParams.append('page', paging.value.page);
    list.value = await std(url);
    loading.value = false;
}
</script>
