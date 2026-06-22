<template>
    <MenuTemplate name='Connections'>
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
            <TablerIconButton
                title='Create Connection'
                @click='external("/connection/new")'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <div class='my-2'>
                <SearchSortFilter
                    v-model='paging.filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
                    placeholder='Filter'
                >
                    <template #sort-icon>
                        <template v-if='sort'>
                            <component
                                :is='sortTypeIcon'
                                :size='20'
                                stroke='1'
                            />
                            <component
                                :is='sortDirectionIcon'
                                :size='20'
                                stroke='1'
                            />
                        </template>
                        <IconArrowsSort
                            v-else
                            :size='20'
                            stroke='1'
                        />
                    </template>
                </SearchSortFilter>
            </div>

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Connections'
                :create='false'
            />
            <template v-else>
                <div
                    role='menu'
                >
                    <div
                        v-for='conn in list.items'
                        :key='conn.id'
                        class='col-12 py-1'
                    >
                        <StandardItem
                            class='d-flex align-items-center py-2 px-3'
                            @click='external(`/connection/${conn.id}`)'
                        >
                            <div class='col-auto'>
                                <ConnectionStatus :connection='conn' />
                            </div>
                            <div
                                class='mx-2'
                                style='width: 315px;'
                            >
                                <div class='col-12'>
                                    <div
                                        class='text-truncate'
                                        v-text='conn.name'
                                    />
                                </div>
                                <div class='col-12 d-flex align-items-center'>
                                    <div
                                        class='subheader'
                                        v-text='timeDiff(conn.created)'
                                    />
                                    <div class='ms-auto'>
                                        <AgencyBadge :connection='conn' />
                                    </div>
                                </div>
                            </div>
                        </StandardItem>
                    </div>
                </div>
            </template>

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
import { ref, computed, onMounted, watch } from 'vue';
import type { ETLConnectionList } from '../../../types.ts';
import { server } from '../../../std.ts';
import {
    TablerNone,
    TablerAlert,
    TablerPager,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconLetterCase,
    IconClock,
    IconArrowUp,
    IconArrowDown,
    IconArrowsSort,
} from '@tabler/icons-vue';

import MenuTemplate from '../util/MenuTemplate.vue';
import SearchSortFilter from '../util/SearchSortFilter.vue';
import StandardItem from '../util/StandardItem.vue';
import ConnectionStatus from './../../ETL/Connection/StatusDot.vue';
import AgencyBadge from './../../ETL/Connection/AgencyBadge.vue';
import timeDiff from '../../../timediff.ts';

const error = ref<Error | undefined>();
const loading = ref(true);
const paging = ref({
    limit: 20,
    filter: '',
    page: 0
});

const sort = ref('Newest → Oldest');
const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'A → Z', 'Z → A'];
const sortTypeIcon = computed(() => (sort.value === 'A → Z' || sort.value === 'Z → A') ? IconLetterCase : IconClock);
const sortDirectionIcon = computed(() => (sort.value === 'Oldest → Newest' || sort.value === 'A → Z') ? IconArrowUp : IconArrowDown);

const list = ref<ETLConnectionList>({
    total: 0,
    status: {
        dead: 0,
        live: 0,
        unknown: 0
    },
    items: []
});

watch(paging.value, async () => {
    await fetchList()
});

watch(sort, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET('/api/connection', {
            params: {
                query: {
                    filter: paging.value.filter,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: (sort.value === 'A → Z' || sort.value === 'Z → A') ? 'name' : 'created',
                    order: (sort.value === 'Oldest → Newest' || sort.value === 'A → Z') ? 'asc' : 'desc'
                }
            }
        });

        if (res.error) throw new Error(res.error.message || 'Failed to load connections');
        if (!res.data) throw new Error('Failed to load connections');

        list.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    } finally {
        loading.value = false;
    }
}

function external(url: string) {
    window.location.href = url;
}
</script>
