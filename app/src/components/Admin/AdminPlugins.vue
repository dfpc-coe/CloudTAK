<template>
    <div>
        <Teleport
            defer
            to='#admin-config-actions'
        >
            <TablerIconButton
                :title='creating ? "Cancel" : "Create Plugin"'
                @click='creating = !creating'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                title='Refresh'
                :size='32'
                :loading='loading'
                @click='fetchList'
            />
        </Teleport>

        <TablerAlert
            v-if='error'
            :err='error'
            @close='error = undefined'
        />

        <div
            v-if='creating'
            class='card m-3'
        >
            <div class='card-body row g-2'>
                <div class='col-12 col-md-4'>
                    <TablerInput
                        v-model='draft.name'
                        label='Name'
                    />
                </div>
                <div class='col-12 col-md-8'>
                    <TablerInput
                        v-model='draft.description'
                        label='Description'
                    />
                </div>
                <div class='col-12 d-flex'>
                    <button
                        class='btn btn-primary ms-auto'
                        :disabled='!draft.name.trim()'
                        @click='createPlugin'
                    >
                        Create
                    </button>
                </div>
            </div>
        </div>

        <div
            v-if='uploading'
            class='card m-3'
        >
            <div class='card-header'>
                <h3 class='card-title'>
                    Upload bundle for {{ uploading.name }}
                </h3>
            </div>
            <div class='card-body'>
                <TablerInput
                    v-model='uploadVersion'
                    label='Version'
                    placeholder='1.0.0'
                />
            </div>
            <Upload
                v-if='uploadUrl'
                :key='uploadUrl.toString()'
                :url='uploadUrl'
                mimetype='.js,.mjs'
                label='Upload the built plugin as a single ES module'
                @cancel='uploading = undefined'
                @done='onUploadDone'
                @error='error = $event'
            />
            <div
                v-else
                class='card-body pt-0 d-flex'
            >
                <button
                    class='btn ms-auto'
                    @click='uploading = undefined'
                >
                    Cancel
                </button>
            </div>
        </div>

        <div style='min-height: 20vh'>
            <TablerLoading
                v-if='loading'
                desc='Loading Plugins'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Plugins'
                :create='false'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table card-table table-vcenter'>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Version</th>
                            <th>Size</th>
                            <th>Updated</th>
                            <th>Enabled</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='plugin in list.items'
                            :key='plugin.id'
                        >
                            <td>
                                <div v-text='plugin.name' />
                                <div
                                    class='text-secondary small'
                                    v-text='plugin.description'
                                />
                            </td>
                            <td>
                                <span
                                    v-if='plugin.version'
                                    :title='plugin.sha256 || ""'
                                    v-text='plugin.version'
                                />
                                <span
                                    v-else
                                    class='text-secondary'
                                >No bundle</span>
                            </td>
                            <td>
                                <TablerBytes
                                    v-if='plugin.size'
                                    :bytes='plugin.size'
                                />
                            </td>
                            <td>
                                <TablerEpoch :date='plugin.updated' />
                            </td>
                            <td>
                                <TablerToggle
                                    :model-value='plugin.enabled'
                                    :disabled='!plugin.sha256'
                                    @update:model-value='setEnabled(plugin, $event)'
                                />
                            </td>
                            <td>
                                <div class='btn-list justify-content-end flex-nowrap'>
                                    <TablerIconButton
                                        title='Upload Bundle'
                                        @click='startUpload(plugin)'
                                    >
                                        <IconUpload
                                            :size='24'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                    <TablerDelete
                                        displaytype='icon'
                                        @delete='deletePlugin(plugin)'
                                    />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { computed, onMounted, ref } from 'vue';
import { server } from '../../std.ts';
import type { PluginList, Plugin } from '../../types.ts';
import Upload from '../util/Upload.vue';
import {
    TablerAlert,
    TablerBytes,
    TablerDelete,
    TablerEpoch,
    TablerIconButton,
    TablerInput,
    TablerLoading,
    TablerNone,
    TablerRefreshButton,
    TablerToggle,
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconUpload,
} from '@tabler/icons-vue';

const error = ref<Error | undefined>();
const loading = ref(true);
const creating = ref(false);
const uploading = ref<Plugin | undefined>();
const uploadVersion = ref('');
const draft = ref({ name: '', description: '' });

const list = ref<PluginList>({
    total: 0,
    items: [],
});

const uploadUrl = computed(() => {
    const version = uploadVersion.value.trim();
    if (!uploading.value || !/^[a-zA-Z0-9][a-zA-Z0-9._+-]*$/.test(version)) return undefined;

    const url = new URL(`/api/plugin/${uploading.value.id}/bundle`, window.location.origin);
    url.searchParams.set('version', version);
    return url;
});

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;

    try {
        const res = await server.GET('/api/plugin', {
            params: {
                query: {
                    limit: 100,
                    page: 0,
                    order: 'asc',
                    sort: 'name',
                    filter: '',
                },
            },
        });

        if (res.error) throw new Error(res.error.message);
        if (res.data) list.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

async function createPlugin() {
    try {
        const res = await server.POST('/api/plugin', {
            body: {
                name: draft.value.name.trim(),
                description: draft.value.description,
            },
        });

        if (res.error) throw new Error(res.error.message);

        draft.value = { name: '', description: '' };
        creating.value = false;

        await fetchList();

        if (res.data) startUpload(res.data);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function setEnabled(plugin: Plugin, enabled: boolean) {
    try {
        const res = await server.PATCH('/api/plugin/{:plugin}', {
            params: {
                path: {
                    ':plugin': plugin.id,
                },
            },
            body: {
                enabled,
            },
        });

        if (res.error) throw new Error(res.error.message);
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    await fetchList();
}

async function deletePlugin(plugin: Plugin) {
    try {
        const res = await server.DELETE('/api/plugin/{:plugin}', {
            params: {
                path: {
                    ':plugin': plugin.id,
                },
            },
        });

        if (res.error) throw new Error(res.error.message);
        if (uploading.value?.id === plugin.id) uploading.value = undefined;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    await fetchList();
}

function startUpload(plugin: Plugin) {
    error.value = undefined;
    uploadVersion.value = '';
    uploading.value = plugin;
}

async function onUploadDone() {
    uploading.value = undefined;
    await fetchList();
}
</script>
