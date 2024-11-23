m<template>
    <MenuTemplate name='Connections'>
        <template #buttons>
            <IconRefresh
                v-if='!loading'
                v-tooltip='"Refresh"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='fetchList'
            />
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
                            :stroke='1'
                        /><span class='mx-2'>Wizard</span>
                    </button>
                </div>
                <div class='col-6 px-2'>
                    <button
                        class='btn btn-secondary w-100'
                        @click='$router.push("/connection/new")'
                    >
                        <IconPlus
                            v-tooltip='"Create Connection"'
                            :size='20'
                            :stroke='1'
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
            <TablerNone
                v-else-if='!list.items.length'
                label='Connections'
                :create='false'
            />
            <template v-else>
                <div
                    v-for='conn in list.items'
                    :key='conn.id'
                    @click='$router.push(`/connection/${conn.id}`)'
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

<script>
import { std, stdurl } from '/src/std.ts';
import IntegrationWizard from '../util/IntegrationWizard.vue';
import {
    TablerNone,
    TablerInput,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconPlus,
    IconWand,
    IconRefresh,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import ConnectionStatus from './../../Connection/Status.vue';
import AgencyBadge from './../../Connection/AgencyBadge.vue';
import timeDiff from '../../../timediff.ts';

export default {
    name: 'CloudTAKConnections',
    components: {
        IconPlus,
        IconWand,
        TablerNone,
        TablerPager,
        TablerInput,
        TablerLoading,
        ConnectionStatus,
        IntegrationWizard,
        AgencyBadge,
        IconRefresh,
        MenuTemplate,
    },
    data: function() {
        return {
            err: false,
            loading: true,
            wizard: false,
            paging: {
                limit: 20,
                filter: '',
                page: 0
            },
            list: []
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetchList()
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        timeDiff(update) {
            return timeDiff(update)
        },
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/connection');
            url.searchParams.append('order', 'desc');
            url.searchParams.append('page', this.paging.page);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('sort', 'created');
            url.searchParams.append('filter', this.paging.filter);
            this.list = await std(url);
            this.loading = false;
        },
    }
}
</script>
