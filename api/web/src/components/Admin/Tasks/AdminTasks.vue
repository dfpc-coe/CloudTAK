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
                    <TablerIconButton
                        title='Upload Task Settings'
                        @click='triggerUpload'
                    >
                        <IconUpload
                            :size='32'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <input
                        ref='uploadInput'
                        type='file'
                        accept='application/json,.json'
                        class='d-none'
                        @change='handleUpload'
                    >
                    <TablerRefreshButton
                        title='Refresh'
                        :loading='loading'
                        @click='fetchList'
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

                        <TablerUploadLogo
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
                                @click='router.push(`/admin/tasks/${layer.id}`)'
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

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router';
import { server } from '../../../std.ts';
import type { APIList } from '../../../types.ts';
import TableHeader from '../../util/TableHeader.vue'
import TableFooter from '../../util/TableFooter.vue'
import {
    TablerNone,
    TablerInput,
    TablerAlert,
    TablerToggle,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
    TablerUploadLogo
} from '@tak-ps/vue-tabler';
import {
    IconStar,
    IconPlus,
    IconUpload,
} from '@tabler/icons-vue'

interface HeaderItem {
    name: string;
    display: boolean;
}

interface Task {
    id?: number;
    name?: string;
    prefix?: string;
    logo?: string;
    favorite?: boolean;
    repo?: string;
    readme?: string;
    [key: string]: unknown;
}

type TaskSort = 'id' | 'prefix' | 'favorite' | 'created' | 'updated' | 'name' | 'logo' | 'repo' | 'readme' | 'enableRLS';

const error = ref<Error>();
const loading = ref<boolean>(true);
const header = ref<HeaderItem[]>([]);
const edit = ref<Task | false>();
const router = useRouter();
const uploadInput = ref<HTMLInputElement | null>(null);
const paging = ref({
    filter: '',
    sort: 'name' as TaskSort,
    order: 'asc' as 'asc' | 'desc',
    limit: 100,
    page: 0
});
const list = ref<APIList<Task>>({
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
    const res = await server.GET('/api/schema', {
        params: {
            query: {
                method: 'GET',
                url: '/task'
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    const schema = res.data as {
        query: { properties: { sort: { enum: string[] } } }
    };
    header.value = ['logo', 'name', 'prefix'].map((h) => {
        return { name: h, display: true };
    });

    header.value.push(...schema.query.properties.sort.enum.map((h: string) => {
        return {
            name: h,
            display: false
        }
    }).filter((h: HeaderItem) => {
        for (const hknown of header.value) {
            if (hknown.name === h.name) return false;
        }
        return true;
    }));
}

async function saveTask() {
    loading.value = true;

    if (edit.value) {
        const res = await server.POST('/api/task', {
            body: {
                name: String(edit.value.name || ''),
                prefix: String(edit.value.prefix || ''),
                favorite: Boolean(edit.value.favorite),
                logo: edit.value.logo || undefined,
                repo: edit.value.repo || undefined,
                readme: edit.value.readme || undefined,
            }
        });

        if (res.error) throw new Error(res.error.message);
    }

    edit.value = false

    await fetchList();
}

function triggerUpload(): void {
    uploadInput.value?.click();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeString(value: unknown, max = 1024): string {
    if (typeof value !== 'string') return '';
    return value.slice(0, max);
}

function safeLogo(value: unknown): string {
    if (typeof value !== 'string') return '';
    // Only accept data URLs for an image MIME, capped to a sane size
    if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(value)) {
        return '';
    }
    if (value.length > 5 * 1024 * 1024) return '';
    return value;
}

async function handleUpload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        error.value = new Error('Uploaded file is too large');
        return;
    }

    let parsed: unknown;
    try {
        const text = await file.text();
        parsed = JSON.parse(text);
    } catch {
        error.value = new Error('Uploaded file is not valid JSON');
        return;
    }

    if (!isPlainObject(parsed)) {
        error.value = new Error('Uploaded JSON must be an object');
        return;
    }

    edit.value = {
        name: safeString(parsed.name, 256),
        prefix: safeString(parsed.prefix, 256),
        repo: safeString(parsed.repo, 2048),
        readme: safeString(parsed.readme, 2048),
        logo: safeLogo(parsed.logo)
    };
}

async function fetchList() {
    loading.value = true;
    const res = await server.GET('/api/task', {
        params: {
            query: {
                filter: paging.value.filter,
                limit: paging.value.limit,
                page: paging.value.page,
                sort: paging.value.sort,
                order: paging.value.order,
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    list.value = res.data as APIList<Task>;
    loading.value = false;
}
</script>
