<template>
    <div>
        <div class='d-flex align-items-center user-select-none'>
            <label class='mx-1 mb-1'>Task Selection</label>
        </div>
        <div class='card'>
            <div class='card-body'>
                <TablerLoading
                    v-if='loading.main'
                    :inline='true'
                    desc='Loading Tasks'
                />
                <TablerLoading
                    v-else-if='loading.task'
                    :inline='true'
                    desc='Loading Task'
                />
                <template v-else-if='selected.id'>
                    <div class='col-12 d-flex align-items-center user-select-none'>
                        <img
                            v-if='selected.logo'
                            :src='selected.logo'
                            alt='Logo Preview'
                            style='height: 50px;'
                            class='img-thumbnail'
                        >
                        <IconBroadcast
                            v-else
                            size='50'
                            stroke='1'
                            class='text-muted'
                        />
                        <div
                            class='mx-2'
                            v-text='selected.name'
                        />
                        <div class='ms-auto btn-list'>
                            <TablerEnum
                                v-model='selected.version'
                                :options='selected.versions'
                            />


                            <TablerIconButton
                                v-if='selected.id'
                                title='Remove Task'
                                @click='selected.id = undefined'
                            >
                                <IconTrash
                                    :size='32'
                                    stroke='1'
                                />
                            </TablerIconButton>
                        </div>
                    </div>
                </template>
                <template v-else>
                    <TablerInput
                        v-model='paging.filter'
                        placeholder='Task Filter...'
                        class='pb-2'
                    />

                    <div
                        v-if='loading.list'
                        class='card-body'
                    >
                        <TablerLoading desc='Loading Tasks' />
                    </div>
                    <TablerNone
                        v-else-if='list.total === 0'
                        :create='false'
                        :compact='true'
                        label='No Tasks'
                    />
                    <div
                        v-else
                        class='row row-cards'
                    >
                        <template
                            v-for='task in list.items'
                        >
                            <div class='col-sm-6 col-lg-3'>
                                <div
                                    class='card card-link cursor-pointer cloudtak-hover'
                                    @click='select(task)'
                                >
                                    <div class='card-header d-flex align-items-center user-select-none'>
                                        <IconStar
                                            v-if='task.favorite'
                                            size='24'
                                            stroke='1'
                                            class='me-2'
                                        />
                                        <div v-text='task.name' />
                                        <div class='ms-auto'>
                                            <TablerIconButton
                                                title='Task Info'
                                                @click.prevent.stop='infoModal = task'
                                            >
                                                <IconInfoSquare
                                                    :size='32'
                                                    stroke='1'
                                                />
                                            </TablerIconButton>
                                        </div>
                                    </div>
                                    <div class='card-body d-flex align-items-center justify-content-center user-select-none'>
                                        <div style='width: 128px; height: 128px;'>
                                            <img
                                                v-if='task.logo'
                                                :src='task.logo'
                                                alt='Logo Preview'
                                                class='img-thumbnail'
                                            >
                                            <IconBroadcast
                                                v-else
                                                size='128'
                                                stroke='1'
                                                class='text-muted'
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                </template>
            </div>
            <div
                v-if='!loading.main && !loading.task && list.total > paging.limit && !selected.id'
                class='card-footer d-flex'
            >
                <div class='ms-auto'>
                    <TablerPager
                        :page='paging.page'
                        :total='list.total'
                        :limit='paging.limit'
                        @page='paging.page = $event'
                    />
                </div>
            </div>
        </div>
    </div>

    <TablerModal
        v-if='infoModal'
        size='xl'
    >
        <div class='modal-header'>
            <IconInfoSquare
                size='24'
                stroke='1'
            />
            <span
                class='mx-2'
                v-text='infoModal.name'
            />
            <button                                       
                type='button'                  
                class='btn-close'            
                aria-label='Close'                                 
                @click='infoModal = undefined'                                            
            />
        </div>
        <div
            class='modal-body overflow-auto'
            style='max-height: 50vh'
        >
            <TablerLoading
                v-if='!infoModal.readme_body'
            />
            <TablerMarkdown
                v-else
                :markdown='infoModal.readme_body'
            />
        </div>
        <div class='modal-footer'>
            <button
                class='btn btn-primary'
                @click='infoModal = undefined'
            >
                Close
            </button>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { server } from '../../std.ts';
import type { APIList } from '../../types.ts';
import {
    IconStar,
    IconTrash,
    IconBroadcast,
    IconInfoSquare,
} from '@tabler/icons-vue';
import {
    TablerModal,
    TablerMarkdown,
    TablerIconButton,
    TablerLoading,
    TablerEnum,
    TablerInput,
    TablerPager,
    TablerNone,
} from '@tak-ps/vue-tabler';

interface Task {
    id?: number;
    name?: string;
    prefix?: string;
    logo?: string | null;
    version?: string;
    versions?: string[];
    favorite?: boolean;
    readme_body?: string;
    repo?: string | null;
    readme?: string | null;
    [key: string]: unknown;
}

const props = withDefaults(defineProps<{
    modelValue?: string;
    disabled?: boolean;
}>(), {
    modelValue: undefined,
    disabled: false,
});

const emit = defineEmits<{
    (e: 'update:modelValue', value: string | undefined): void;
}>();

const loading = ref<Record<string, boolean>>({
    main: true,
    modal: true,
    list: true,
});

const infoModal = ref<Task>();

const selected = ref<Task>({
    id: undefined
});

const paging = ref({
    filter: '',
    limit: 12,
    sort: 'favorite' as const,
    order: 'desc' as const,
    page: 0
});

const list = ref<APIList<Task>>({
    total: 0,
    items: []
});

function selectedModelValue(): string | undefined {
    if (!selected.value.prefix || !selected.value.version) return undefined;
    return `${selected.value.prefix}-v${selected.value.version}`;
}

async function resolveTask(task: Task): Promise<Task> {
    if (task.id) return task;

    const existing = list.value.items.find((item) => item.prefix === task.prefix);
    if (existing) return existing;

    const res = await server.GET('/api/task', {
        params: {
            query: {
                filter: String(task.prefix || ''),
                limit: 1,
                page: 0,
                order: paging.value.order,
                sort: paging.value.sort
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    const match = res.data.items.find((item) => item.prefix === task.prefix);

    return match || task;
}

watch(selected, () => {
    if (selected.value.id) {
        emit('update:modelValue', `${selected.value.prefix}-v${selected.value.version}`);
    } else {
        emit('update:modelValue', undefined);
    }
}, {
    deep: true
});

watch(infoModal, async function() {
    if (!infoModal.value) return;

    const res = await server.GET('/api/task/{:task}/readme', {
        params: {
            path: {
                ':task': Number(infoModal.value.id)
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    infoModal.value.readme_body = res.data.body;
})

watch(() => props.modelValue, async function() {
    if (!props.modelValue) {
        selected.value = {
            id: undefined
        };
        return;
    }

    if (props.modelValue === selectedModelValue()) {
        return;
    }

    await select({ prefix: props.modelValue.split('-v')[0] } as Task, props.modelValue.split('-v')[1])
});

watch(paging.value, async () => {
    await listTasks();
});

onMounted(async () => {
    if (props.modelValue) {
        await select({ prefix: props.modelValue.split('-v')[0] } as Task, props.modelValue.split('-v')[1])
    }

    await listTasks();
    loading.value.main = false;
});

async function select(task: Task, version?: string) {
    loading.value.task = true;

    const resolvedTask = await resolveTask(task);
    const res = await server.GET('/api/task/raw/{:task}', {
        params: {
            path: {
                ':task': String(task.prefix)
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    const versions = res.data.versions.map((v) => v.version);
    selected.value = {
        versions,
        version: version || versions[0],
        ...resolvedTask
    }

    loading.value.task = false;
}

async function listTasks() {
    loading.value.list = true;
    const res = await server.GET('/api/task', {
        params: {
            query: {
                filter: paging.value.filter,
                limit: paging.value.limit,
                order: paging.value.order,
                sort: paging.value.sort,
                page: paging.value.page
            }
        }
    });

    if (res.error) throw new Error(res.error.message);
    list.value = res.data as APIList<Task>;

    loading.value.list = false;
}
</script>
