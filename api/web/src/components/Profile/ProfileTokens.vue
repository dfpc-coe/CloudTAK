<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                API Tokens
            </h3>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"New Token"'
                    size='32'
                    class='cursor-pointer'
                    @click='token={}'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    size='32'
                    class='cursor-pointer'
                    @click='fetch'
                />
            </div>
        </div>

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
                        <td><TablerEpoch :date='t.created' /></td>
                        <td><TablerEpoch :date='t.updated' /></td>
                    </tr>
                </tbody>
            </table>
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
import { std } from '/src/std.ts';
import TokenModal from './TokenModal.vue';
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
    name: 'ProfileTokens',
    components: {
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
            tokens: {
                total: 0,
                items: []
            }
        }
    },
    mounted: async function() {
        await this.fetch();
    },
    methods: {
        fetch: async function() {
            this.token = false;
            this.loading = true;
            this.tokens = await std('/api/token');
            this.loading = false;
        },
    }
}
</script>
