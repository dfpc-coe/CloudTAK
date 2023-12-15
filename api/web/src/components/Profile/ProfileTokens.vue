<template>
<div>
    <div class="card-header">
        <h3 class="card-title">API Tokens</h3>

        <div class='ms-auto btn-list'>
            <IconPlus @click='push()' class='cursor-pointer'/>
        </div>
    </div>

    <TablerNone v-if='!list.tokens.length' :create='false' label='Tokens'/>
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
                <tr @click='token = t' :key='t.id' v-for='(t, tokenit) in list.tokens'>
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
    name: 'ProfileTokens',
    data: function() {
        return {
            loading: true,
            token: false,
            list: {
                total: 0,
                tokens: []
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
            this.list = await window.std('/api/token');
            this.loading = false;
        },
        push: function() {
            this.list.tokens.splice(0, 0, {
                _edit: true,
                name: '',
                updated: +new Date(),
                created: +new Date()
            });
        }
    },
    components: {
        TokenModal,
        TablerNone,
        IconPlus,
        IconCheck,
        IconTrash,
        TablerEpoch,
        TablerLoading,
        TablerInput
    }
}
</script>
