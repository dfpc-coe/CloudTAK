<template>
    <div>
        <Teleport
            defer
            to='#admin-config-actions'
        >
            <TablerIconButton
                :title='uploading ? "Cancel" : "Upload Plugin"'
                @click='uploading = !uploading'
            >
                <IconUpload
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

        <TablerInlineAlert
            class='px-3 pt-3'
            severity='info'
            title='Beta'
            description='Plugins are in beta and the plugin API may change between releases.'
        />

        <TablerAlert
            v-if='error'
            :err='error'
            @close='error = undefined'
        />

        <div
            v-if='uploading'
            class='card m-3'
        >
            <Upload
                :url='uploadUrl'
                mimetype='.tar.gz,.tgz,application/gzip'
                label='Upload a plugin bundle (.tar.gz)'
                @cancel='uploading = false'
                @done='onUploadDone'
                @error='error = $event'
            />
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
                                <PluginSummary :plugin='plugin' />
                            </td>
                            <td>
                                <span
                                    :title='plugin.sha256 || ""'
                                    v-text='plugin.version'
                                />
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
import { onMounted, ref } from 'vue';
import { server } from '../../std.ts';
import type { PluginList, Plugin } from '../../types.ts';
import Upload from '../util/Upload.vue';
import PluginSummary from '../util/PluginSummary.vue';
import {
    TablerAlert,
    TablerBytes,
    TablerDelete,
    TablerEpoch,
    TablerIconButton,
    TablerInlineAlert,
    TablerLoading,
    TablerNone,
    TablerRefreshButton,
    TablerToggle,
} from '@tak-ps/vue-tabler';
import { IconUpload } from '@tabler/icons-vue';

const error = ref<Error | undefined>();
const loading = ref(true);
const uploading = ref(false);
const uploadUrl = new URL('/api/plugin/bundle', window.location.origin);

const list = ref<PluginList>({
    total: 0,
    items: [],
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
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    await fetchList();
}

async function onUploadDone() {
    error.value = undefined;
    uploading.value = false;
    await fetchList();
}
</script>
