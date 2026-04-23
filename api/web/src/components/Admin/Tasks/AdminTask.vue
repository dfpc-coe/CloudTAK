<template>
    <div>
        <div class='card-header'>
            <TablerIconButton
                title='Back'
                @click='router.push("/admin/tasks")'
            >
                <IconCircleArrowLeft
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <h3
                class='mx-2 card-title d-flex align-items-center'
            >
                <IconStar
                    v-if='task && task.favorite'
                />
                <span
                    class='ms-2'
                    v-text='task ? task.name : route.params.task'
                />
            </h3>

            <div class='ms-auto btn-list'>
                <template v-if='task && !edit'>
                    <TablerIconButton
                        title='Download Task Settings'
                        @click='downloadTask'
                    >
                        <IconDownload
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerIconButton
                        title='Edit Task'
                        @click='startEdit'
                    >
                        <IconPencil
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <TablerDelete
                        displaytype='icon'
                        @delete='deleteTask'
                    />
                    <TablerRefreshButton
                        title='Refresh'
                        :loading='loading'
                        @click='fetch'
                    />
                </template>
            </div>
        </div>

        <TablerLoading v-if='loading' />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <template v-else-if='task'>
            <div class='card-body'>
                <template v-if='edit'>
                    <div class='row g-2'>
                        <div class='col-md-6 col-12'>
                            <TablerInput
                                v-model='edit.name'
                                label='Task Name'
                            />
                        </div>
                        <div class='col-md-6 col-12'>
                            <TablerInput
                                v-model='edit.prefix'
                                :disabled='true'
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
                                @click='edit = null'
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
                <template v-else>
                    <div class='datagrid'>
                        <div class='datagrid-item'>
                            <div class='datagrid-title'>
                                Container Prefix
                            </div>
                            <div
                                class='datagrid-content'
                                v-text='task.prefix'
                            />
                        </div>
                        <div
                            v-if='task.repo'
                            class='datagrid-item'
                        >
                            <div class='datagrid-title'>
                                Repository
                            </div>
                            <div class='datagrid-content'>
                                <a
                                    :href='task.repo'
                                    target='_blank'
                                    v-text='task.repo'
                                />
                            </div>
                        </div>
                        <div
                            v-if='task.readme'
                            class='datagrid-item'
                        >
                            <div class='datagrid-title'>
                                Readme
                            </div>
                            <div class='datagrid-content'>
                                <a
                                    :href='task.readme'
                                    target='_blank'
                                    v-text='task.readme'
                                />
                            </div>
                        </div>
                        <div
                            v-if='task.logo'
                            class='datagrid-item'
                        >
                            <div class='datagrid-title'>
                                Logo
                            </div>
                            <div class='datagrid-content'>
                                <img
                                    :src='task.logo'
                                    alt='Task Logo'
                                    class='img-thumbnail'
                                    style='height: 50px;'
                                >
                            </div>
                        </div>
                    </div>
                </template>
            </div>

            <div class='card-header'>
                <h3 class='card-title'>
                    Uploaded Versions
                </h3>
                <div class='ms-auto'>
                    <TablerRefreshButton
                        title='Refresh Versions'
                        :loading='loadingVersions'
                        @click='fetchVersions'
                    />
                </div>
            </div>
            <TablerLoading v-if='loadingVersions' />
            <TablerNone
                v-else-if='!versions.length'
                label='No Versions Uploaded'
                :create='false'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table card-table table-hover table-vcenter datatable'>
                    <tbody>
                        <tr
                            v-for='version in versions'
                            :key='version.version'
                        >
                            <td>
                                <div class='d-flex align-items-center'>
                                    <span v-text='version.version' />
                                    <div class='ms-auto d-flex align-items-center'>
                                        <TablerBadge
                                            v-if='version.deployed'
                                            class='mx-2'
                                        >
                                            Deployed
                                        </TablerBadge>
                                        <TablerDelete
                                            v-if='!version.deployed'
                                            displaytype='icon'
                                            @delete='deleteVersion(version.version)'
                                        />
                                    </div>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std } from '../../../std.ts';
import type { ETLTaskVersions } from '../../../types.ts';
import UploadLogo from '../../util/UploadLogo.vue';
import {
    TablerNone,
    TablerBadge,
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
    IconPencil,
    IconDownload,
    IconCircleArrowLeft
} from '@tabler/icons-vue';

interface Task {
    id: number;
    name: string;
    prefix: string;
    logo?: string;
    favorite?: boolean;
    repo?: string;
    readme?: string;
    [key: string]: unknown;
}

const router = useRouter();
const route = useRoute();

const loading = ref<boolean>(true);
const loadingVersions = ref<boolean>(true);
const error = ref<Error>();
const task = ref<Task | null>(null);
const edit = ref<Task | null>(null);
const versions = ref<Array<{ version: string; deployed: boolean }>>([]);

onMounted(async () => {
    await fetch();
});

async function fetch(): Promise<void> {
    loading.value = true;
    error.value = undefined;
    try {
        task.value = await std(`/api/task/${route.params.task}`) as Task;
        await fetchVersions();
    } catch (err) {
        error.value = err as Error;
    } finally {
        loading.value = false;
    }
}

async function fetchVersions(): Promise<void> {
    if (!task.value) return;
    loadingVersions.value = true;
    try {
        const res = await std(`/api/task/raw/${task.value.prefix}`) as ETLTaskVersions;
        versions.value = res.versions;
    } finally {
        loadingVersions.value = false;
    }
}

function startEdit(): void {
    if (!task.value) return;
    edit.value = { ...task.value };
}

async function saveTask(): Promise<void> {
    if (!edit.value) return;
    loading.value = true;
    try {
        task.value = await std(`/api/task/${edit.value.id}`, {
            method: 'PATCH',
            body: {
                name: edit.value.name,
                favorite: edit.value.favorite,
                logo: edit.value.logo,
                repo: edit.value.repo,
                readme: edit.value.readme
            }
        }) as Task;
        edit.value = null;
    } finally {
        loading.value = false;
    }
}

async function deleteTask(): Promise<void> {
    if (!task.value) return;
    await std(`/api/task/${task.value.id}`, {
        method: 'DELETE'
    });
    router.push('/admin/tasks');
}

async function downloadTask(): Promise<void> {
    if (!task.value) return;

    let logoBase64: string | null = null;
    if (task.value.logo) {
        try {
            const res = await window.fetch(task.value.logo);
            const blob = await res.blob();
            logoBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(blob);
            });
        } catch {
            logoBase64 = null;
        }
    }

    const payload = {
        name: task.value.name,
        prefix: task.value.prefix,
        repo: task.value.repo ?? null,
        readme: task.value.readme ?? null,
        logo: logoBase64
    };

    const blob = new Blob([JSON.stringify(payload, null, 4)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${task.value.prefix}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function deleteVersion(version: string): Promise<void> {
    if (!task.value) return;
    loadingVersions.value = true;
    await std(`/api/task/raw/${task.value.prefix}/version/${version}`, {
        method: 'DELETE'
    });
    await fetchVersions();
}
</script>
