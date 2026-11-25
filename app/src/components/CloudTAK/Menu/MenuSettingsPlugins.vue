<template>
    <MenuTemplate name='Plugins'>
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
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
                    :hover='false'
                >
                    <div class='d-flex align-items-center px-2 py-2'>
                        <img
                            v-if='plugin.logo'
                            :src='plugin.logo'
                            :alt='`${plugin.name} logo`'
                            width='32'
                            height='32'
                            style='object-fit: contain;'
                        >
                        <IconPuzzle
                            v-else
                            :size='32'
                            stroke='1'
                        />
                        <div
                            class='ms-2 flex-grow-1'
                            style='min-width: 0;'
                        >
                            <div class='d-flex align-items-center'>
                                <div
                                    class='font-weight-bold text-truncate'
                                    v-text='plugin.name'
                                />
                                <div
                                    v-if='plugin.version'
                                    class='ms-auto subheader'
                                    v-text='`v${plugin.version}`'
                                />
                            </div>
                            <div
                                v-if='plugin.author'
                                class='subheader text-truncate'
                                v-text='`by ${plugin.author}`'
                            />
                            <div
                                v-if='plugin.description'
                                class='subheader text-wrap'
                                v-text='plugin.description'
                            />
                            <div
                                v-if='plugin.license || plugin.homepage'
                                class='subheader d-flex align-items-center gap-2'
                            >
                                <span
                                    v-if='plugin.license'
                                    v-text='plugin.license'
                                />
                                <a
                                    v-if='plugin.homepage'
                                    :href='plugin.homepage'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >Homepage</a>
                            </div>
                        </div>
                    </div>
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
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue';
import type { PluginList } from '../../../types.ts';
import { server } from '../../../std.ts';
import {
    TablerNone,
    TablerAlert,
    TablerPager,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import { IconPuzzle } from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import StandardItem from '../util/StandardItem.vue';

const error = ref<Error | undefined>();
const loading = ref(true);
const paging = ref({
    limit: 20,
    page: 0
});

const list = ref<PluginList>({
    total: 0,
    items: []
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;
    error.value = undefined;

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
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}
</script>
