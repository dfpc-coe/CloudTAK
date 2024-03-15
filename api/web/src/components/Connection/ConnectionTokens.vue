<template>
<div>
    <div class="card-header">
        <h3 class="card-title">API Tokens</h3>

        <div class='ms-auto btn-list'>
            <IconPlus @click='token={}' size='32' class='cursor-pointer' v-tooltip='"New Token"'/>
            <IconRefresh @click='fetch' size='32' class='cursor-pointer' v-tooltip='"Refresh"'/>
        </div>
    </div>

    <TablerNone v-if='!tokens.items.length' :create='false' label='Tokens'/>
    <TablerLoading v-else-if='loading'/>
    <div v-else class="table-responsive">
        <table class="table table-hover card-table table-vcenter cursor-pointer">
            <thead>
                <tr>
                    <th>Token Name</th>
                    <th>Created</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                <tr @click='token = t' :key='t.id' v-for='(t, tokenit) in tokens.items'>
                    <td v-text='t.name'/>
                    <td><TablerEpoch :date='t.created'/></td>
                    <td><TablerEpoch :date='t.updated'/></td>
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
import TokenModal from './TokenModal.vue';
import {
    IconPlus,
    IconRefresh,
    IconCheck,
    IconTrash
} from '@tabler/icons-vue';
import {
    TablerEpoch,
    TablerLoading,
    TablerInput,
    TablerNone,
} from '@tak-ps/vue-tabler';

export default {
    name: 'ConnectionTokens',
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
            this.tokens = await window.std(`/api/connection/${this.$route.params.connectionid}/token`);
            this.loading = false;
        },
    },
    components: {
        TokenModal,
        TablerNone,
        IconPlus,
        IconRefresh,
        IconCheck,
        IconTrash,
        TablerEpoch,
        TablerLoading,
        TablerInput
    }
}
</script>
