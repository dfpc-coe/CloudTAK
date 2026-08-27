<script setup lang='ts'>
import { server } from '../../../../std.ts';
import type { ETLTaskVersions } from '../../../../types.ts';
import {
    TablerMarkdown,
    TablerLoading,
    TablerInput,
    TablerPager,
    TablerModal,
    TablerNone,
    TablerEnum,
} from '@tak-ps/vue-tabler';
import { ref, reactive, watch, onMounted } from 'vue';

interface TaskItem {
    id: number;
    name: string;
    prefix: string;
    readme?: string | null;
    [key: string]: unknown;
}

type TaskSort = 'id' | 'prefix' | 'favorite' | 'created' | 'updated' | 'name' | 'logo' | 'repo' | 'readme' | 'enableRLS';

const props = withDefaults(defineProps<{
    modelValue?: string;
}>(), {
    modelValue: '',
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'close'): void;
}>();

// Browse the task list only when no task is set or the user asks to change it
const browsing = ref(!props.modelValue);

const loading = reactive({
    version: false,
    tasks: true,
    task: false,
});

const current = ref<TaskItem | null>(null);
const version = ref('');
const versions = ref<string[]>([]);

const paging = reactive({
    filter: '',
    limit: 10,
    sort: 'name' as TaskSort,
    order: 'asc' as 'asc' | 'desc',
    page: 0
});

const list = reactive<{ total: number; items: TaskItem[] }>({
    total: 0,
    items: []
});

async function fetchTask() {
    if (!current.value) {
        versions.value = [];
    } else {
        loading.task = true;
        const taskRes = await server.GET('/api/task/raw/{:task}', {
            params: {
                path: {
                    ':task': current.value.prefix
                }
            }
        });

        if (taskRes.error) throw new Error(taskRes.error.message);

        versions.value = (taskRes.data as ETLTaskVersions).versions.map((v) => v.version);

        if (!version.value || !versions.value.includes(version.value)) {
            version.value = versions.value[0] || '';
        }

        if (current.value.readme) {
            const readmeRes = await server.GET('/api/task/{:task}/readme', {
                params: {
                    path: {
                        ':task': current.value.id
                    }
                }
            });

            if (readmeRes.error) throw new Error(readmeRes.error.message);

            current.value.readme = readmeRes.data.body;
        }
    }
    loading.task = false;
}

async function fetchTasks() {
    loading.tasks = true;
    const res = await server.GET('/api/task', {
        params: {
            query: {
                filter: paging.filter,
                limit: paging.limit,
                page: paging.page,
                sort: paging.sort,
                order: paging.order,
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    list.total = res.data.total;
    list.items = res.data.items as TaskItem[];


    if (!current.value && list.total && list.items.length) {
        current.value = list.items[0];
    }

    loading.tasks = false;
}

async function fetchCurrent() {
    const match = props.modelValue.match(/^(.+)-v([0-9]+\.[0-9]+\.[0-9]+)$/);
    if (!match) return;

    loading.task = true;

    const res = await server.GET('/api/task', {
        params: {
            query: {
                filter: match[1],
                limit: 1,
                page: 0,
                sort: 'name',
                order: 'asc',
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    const task = (res.data.items as TaskItem[]).find((t) => t.prefix === match[1]);
    if (!task) {
        browsing.value = true;
        loading.task = false;
        return;
    }

    version.value = match[2];
    current.value = task;
}

function select() {
    if (!current.value) return;
    emit('update:modelValue', `${current.value.prefix}-v${version.value}`);
    emit('close');
}

watch(current, fetchTask);

watch(paging, fetchTasks, { deep: true });

onMounted(async () => {
    if (props.modelValue) await fetchCurrent();
    if (browsing.value) await fetchTasks();
});

watch(browsing, async () => {
    if (browsing.value && !list.items.length) await fetchTasks();
});

</script>

<template>
    <TablerModal size='xl'>
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='emit("close")'
        />
        <div class='modal-status bg-yellow' />
        <div class='modal-body py-4'>
            <div class='row g-0'>
                <div
                    v-if='browsing'
                    class='col-12 col-md-3 border-end'
                >
                    <div class='card-header'>
                        <div class='card-title subheader'>
                            Task Selection
                        </div>
                    </div>

                    <div class='pb-2'>
                        <TablerInput
                            v-model='paging.filter'
                            placeholder='Filter Tasks'
                        />
                    </div>

                    <TablerLoading
                        v-if='loading.tasks'
                        desc='Loading Tasks'
                    />
                    <template v-else>
                        <div class='card-body'>
                            <div
                                role='menu'
                                class='list-group'
                            >
                                <span
                                    v-for='t of list.items'
                                    :key='t.prefix'
                                    tabindex='0'
                                    role='menuitem'
                                    class='list-group-item list-group-item-action d-flex align-items-center'
                                    :class='{
                                        "active": current && current.prefix === t.prefix,
                                        "cursor-pointer": !current || current.prefix !== t.prefix
                                    }'
                                    @click='current = t'
                                >
                                    <span
                                        class='mx-3'
                                        v-text='t.name'
                                    />
                                </span>
                            </div>
                        </div>
                    </template>

                    <div class='col-lg-12 py-2 d-flex'>
                        <div class='ms-auto'>
                            <TablerPager
                                v-if='list.total > paging.limit'
                                :page='paging.page'
                                :total='list.total'
                                :limit='paging.limit'
                                @page='paging.page = $event'
                            />
                        </div>
                    </div>
                </div>
                <div
                    class='position-relative px-4'
                    :class='browsing ? "col-12 col-md-9" : "col-12"'
                >
                    <TablerLoading
                        v-if='loading.task'
                        desc='Loading Task'
                    />
                    <TablerNone
                        v-else-if='!current'
                        :create='false'
                    />
                    <div v-else>
                        <div class='card-header d-flex align-items-center'>
                            <div
                                class='card-title subheader'
                                v-text='`${current.name} (${current.prefix})`'
                            />
                            <div
                                v-if='!browsing'
                                class='ms-auto'
                            >
                                <button
                                    class='btn btn-sm btn-secondary'
                                    @click='browsing = true'
                                >
                                    Change Task
                                </button>
                            </div>
                        </div>
                        <div class='card-body'>
                            <TablerMarkdown
                                class='card-body'
                                :markdown='current.readme'
                            />
                        </div>
                        <div class='card-footer'>
                            <div class='row g-2'>
                                <template v-if='versions.length'>
                                    <div class='col-md-8'>
                                        <TablerEnum
                                            v-model='version'
                                            :options='versions'
                                        />
                                    </div>
                                    <div class='col-md-4'>
                                        <button
                                            class='btn btn-primary w-100'
                                            style='margin-top: 8px;'
                                            @click='select'
                                        >
                                            Select
                                        </button>
                                    </div>
                                </template>
                                <template v-else>
                                    Task is registered but contains no active versions
                                </template>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </TablerModal>
</template>

