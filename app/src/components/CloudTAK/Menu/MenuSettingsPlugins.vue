<template>
    <MenuTemplate name='Plugins'>
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <TablerInlineAlert
                class='mb-2'
                severity='info'
                title='Beta'
                description='Plugins are in beta and may change or stop working between releases.'
            />
            <TablerAlert
                v-if='toggleError'
                :err='toggleError'
            />
            <TablerInlineAlert
                v-if='offline && !loading'
                severity='warning'
                title='Offline'
                description='Showing plugins stored on this device'
            />
            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Plugins'
                :create='false'
            />
            <div
                v-else
                class='col-12 d-flex flex-column gap-2 py-3'
            >
                <StandardItem
                    v-for='plugin in list.items'
                    :key='plugin.id'
                    class='cursor-pointer'
                    :class='{ "plugin-loaded": loadedPlugins.has(plugin.id) }'
                    :aria-pressed='loadedPlugins.has(plugin.id)'
                    :title='loadedPlugins.has(plugin.id) ? `Unload ${plugin.name}` : `Load ${plugin.name}`'
                    @click='request(plugin)'
                >
                    <PluginSummary
                        class='px-2 py-2'
                        :plugin='plugin'
                    >
                        <TablerLoading
                            v-if='busy === plugin.id'
                            :inline='true'
                            desc=''
                        />
                        <span
                            v-else-if='loadedPlugins.has(plugin.id)'
                            class='badge bg-green text-white'
                        >Loaded</span>
                        <div
                            v-if='plugin.version'
                            class='subheader'
                            v-text='`v${plugin.version}`'
                        />
                    </PluginSummary>
                </StandardItem>
            </div>

            <div class='py-2 d-flex'>
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

            <TablerConfirm
                v-model:open='confirmLoad'
                displaytype='none'
                label='Load'
                heading='Load Plugin'
                :description='`${pending?.name} will be stored on this device and run with full access to CloudTAK each time it starts.`'
                @confirm='toggle'
            />
            <TablerDelete
                v-model:open='confirmUnload'
                displaytype='none'
                label='Unload'
                @delete='toggle'
            />
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue';
import type { Plugin, PluginList } from '../../../types.ts';
import { loadedPlugins, loadPlugin, unloadPlugin, reconcilePlugins } from '../../../plugin-loader.ts';
import { listStoredPlugins } from '../../../utils/plugin-store.ts';
import { server } from '../../../std.ts';
import {
    TablerNone,
    TablerAlert,
    TablerConfirm,
    TablerDelete,
    TablerInlineAlert,
    TablerPager,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';
import PluginSummary from '../../util/PluginSummary.vue';

const error = ref<Error | undefined>();
const toggleError = ref<Error | undefined>();
const busy = ref<string | undefined>();
const pending = ref<Plugin | undefined>();
const confirmLoad = ref(false);
const confirmUnload = ref(false);
const offline = ref(false);
const loading = ref(true);
const paging = ref({
    limit: 20,
    page: 0
});

const list = ref<PluginList>({
    total: 0,
    items: []
});

watch(paging.value, fetchList);
onMounted(fetchList);

function request(plugin: Plugin) {
    if (busy.value) return;

    pending.value = plugin;

    if (loadedPlugins.has(plugin.id)) confirmUnload.value = true;
    else confirmLoad.value = true;
}

async function toggle() {
    const plugin = pending.value;
    if (!plugin) return;

    busy.value = plugin.id;
    toggleError.value = undefined;

    try {
        if (loadedPlugins.has(plugin.id)) await unloadPlugin(plugin.id);
        else await loadPlugin(plugin);
    } catch (err) {
        toggleError.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        busy.value = undefined;
        confirmLoad.value = false;
        confirmUnload.value = false;
    }
}

async function fetchList() {
    loading.value = true;
    error.value = undefined;
    offline.value = false;

    try {
        const res = await server.GET('/api/plugin', {
            params: {
                query: {
                    enabled: true,
                    filter: '',
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: 'name',
                    order: 'asc'
                }
            }
        });

        if (res.error) throw new Error(res.error.message || 'Failed to load plugins');

        list.value = res.data;

        await reconcilePlugins();
    } catch (err) {
        const stored = await listStoredPlugins();

        if (stored.length) {
            offline.value = true;
            list.value = { total: stored.length, items: stored };
        } else {
            error.value = err instanceof Error ? err : new Error(String(err));
        }
    } finally {
        loading.value = false;
    }
}
</script>

<style scoped>
.plugin-loaded {
    border-color: var(--tblr-green);
}
</style>
