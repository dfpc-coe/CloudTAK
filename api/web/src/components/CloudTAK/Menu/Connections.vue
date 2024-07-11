<template>
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
            <div class='col-12 px-2 pb-2'>
                <TablerInput
                    icon='search'
                    v-model='paging.filter'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                label='Imports'
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
                            <ConnectionStatus :connection='conn'/>
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
                                    <AgencyBadge :connection='conn' :muted='true'/>
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
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    TablerNone,
    TablerInput,
    TablerPager,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
} from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import ConnectionStatus from './../../Connection/Status.vue';
import AgencyBadge from './../../Connection/AgencyBadge.vue';
import Status from '../../util/Status.vue';
import timeDiff from '../../../timediff.js';

export default {
    name: 'CloudTAKImports',
    components: {
        Status,
        TablerNone,
        TablerPager,
        TablerInput,
        TablerLoading,
        ConnectionStatus,
        AgencyBadge,
        IconRefresh,
        MenuTemplate,
    },
    data: function() {
        return {
            err: false,
            loading: true,
            paging: {
                limit: 20,
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
            this.list = await std(url);
            this.loading = false;
        },
    }
}
</script>
