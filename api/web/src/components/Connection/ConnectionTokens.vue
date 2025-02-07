<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                API Tokens
            </h3>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"New Token"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='token={}'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    stroke='1'
                    class='cursor-pointer'
                    @click='fetch'
                />
            </div>
        </div>

        <div style='min-height: 20vh; margin-bottom: 61px'>
            <TablerNone
                v-if='!tokens.items.length'
                :create='false'
                label='Tokens'
            />
            <TablerLoading v-else-if='loading' />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table table-hover card-table table-vcenter cursor-pointer'>
                    <thead>
                        <tr>
                            <th>Token Name</th>
                            <th>Created</th>
                            <th>Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='t in tokens.items'
                            :key='t.id'
                            @click='token = t'
                        >
                            <td v-text='t.name' />
                            <td><TablerEpoch :date='+new Date(t.created)' /></td>
                            <td><TablerEpoch :date='+new Date(t.updated)' /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div
            class='position-absolute bottom-0 w-100'
            style='height: 61px;'
        >
            <TableFooter
                :limit='paging.limit'
                :total='tokens.total'
                @page='paging.page = $event'
            />
        </div>

        <TokenModal
            v-if='token'
            :token='token'
            @close='token = false'
            @refresh='fetch'
        />
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import TokenModal from './TokenModal.vue';
import TableFooter from '../util/TableFooter.vue';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';
import {
    TablerEpoch,
    TablerLoading,
    TablerNone,
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionTokens',
    components: {
        TableFooter,
        TokenModal,
        TablerNone,
        IconPlus,
        IconRefresh,
        TablerEpoch,
        TablerLoading,
    },
    data: function() {
        return {
            loading: true,
            token: false,
            paging: {
                filter: '',
                limit: 10,
                page: 0
            },
            tokens: {
                total: 0,
                items: []
            }
        }
    },
    watch: {
        paging: {
            deep: true,
            handler: async function() {
                await this.fetch();
            },
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.token = false;
            this.loading = true;
            const url = stdurl(`/api/connection/${this.$route.params.connectionid}/token`);
            url.searchParams.append('limit', this.paging.limit);
            url.searchParams.append('page', this.paging.page);
            url.searchParams.append('filter', this.paging.filter);
            this.tokens = await std(url);
            this.loading = false;
        },
    }
}
</script>
