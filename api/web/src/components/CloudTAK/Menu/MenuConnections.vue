m<template>
    <MenuTemplate name='Connections'>
        <template #buttons>
            <TablerIconButton
                v-if='!loading'
                title='"Refresh"'
                @click='fetchList'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>
        <template #default>
            <div class='row g-0 py-2'>
                <div class='col-6 px-2'>
                    <button
                        class='btn btn-primary w-100'
                        @click='wizard = true'
                    >
                        <IconWand
                            v-tooltip='"Create Connection"'
                            :size='20'
                            stroke='1'
                        /><span class='mx-2'>Wizard</span>
                    </button>
                </div>
                <div class='col-6 px-2'>
                    <button
                        class='btn btn-secondary w-100'
                        @click='router.push("/connection/new")'
                    >
                        <IconPlus
                            v-tooltip='"Create Connection"'
                            :size='20'
                            stroke='1'
                        /><span class='mx-2'>New Connection</span>
                    </button>
                </div>
            </div>

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
                        tabindex='0'
                        role='menuitem'
                        @click='router.push(`/connection/${conn.id}`)'
                    >
                        <div class='cursor-pointer col-12 py-2 px-3 d-flex align-items-center hover-dark'>
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
                        </div>
                    </div>
                </div>
            </template>

            <div class='px-2 py-2'>
                <TablerPager
                    v-if='list.total > paging.limit'
                    :page='paging.page'
                    :total='list.total'
                    :limit='paging.limit'
                    @page='paging.page = $event'
                />
            </div>
        </template>
    </MenuTemplate>

    <IntegrationWizard
        v-if='wizard'
        @close='wizard = false'
    />
</template>

<script setup lang='ts'>
import { ref, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import type { ETLConnectionList } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import IntegrationWizard from '../util/IntegrationWizard.vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerPager,
    TablerLoading,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconWand,
    IconRefresh,
} from '@tabler/icons-vue';

import MenuTemplate from '../util/MenuTemplate.vue';
import ConnectionStatus from './../../Connection/StatusDot.vue';
import AgencyBadge from './../../Connection/AgencyBadge.vue';
import timeDiff from '../../../timediff.ts';

const router = useRouter();

const error = ref<Error | undefined>();
const loading = ref(true);
const wizard  = ref(false);
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
</script>
