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
            <div class='col-12 px-2 pb-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Connections'
                :create='false'
            />
            <template v-else>
                <div
                    role='menu'
                >
                    <div
                        v-for='conn in list.items'
                        :key='conn.id'
                        class='col-12 px-2 py-1'
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
                                        <AgencyBadge
                                            :connection='conn'
                                            :muted='true'
                                        />
                                    </div>
                                </div>
                            </div>
                        </StandardItem>
                    </div>
                </div>
            </template>

            <div class='px-2 py-2 d-flex'>
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
import type { ETLConnectionList } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerPager,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
} from '@tabler/icons-vue';

import MenuTemplate from '../util/MenuTemplate.vue';
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

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;

    try {
        const url = stdurl('/api/connection');
        url.searchParams.append('order', 'desc');
        url.searchParams.append('page', String(paging.value.page));
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('sort', 'created');
        url.searchParams.append('filter', paging.value.filter);
        list.value = await std(url) as ETLConnectionList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

function external(url: string) {
    window.location.href = url;
}
</script>
