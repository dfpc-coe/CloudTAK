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
        <table class="table card-table table-vcenter">
            <thead>
                <tr>
                    <th>Token Name</th>
                    <th>Created</th>
                    <th>Updated</th>
                </tr>
            </thead>
            <tbody>
                <tr :key='token.id' v-for='(token, tokenit) in list.tokens'>
                    <td>
                        <template v-if='token._edit'>
                            <TablerInput v-on:keyup.enter='saveToken(token, tokenit)' v-model='token.name'/>
                        </template>
                        <template v-else>
                            <span v-text='token.name'/>
                        </template>
                    </td>
                    <td><TablerEpoch :date='token.created'/></td>
                    <td>
                        <div class='d-flex'>
                            <TablerEpoch :date='token.updated'/>
                            <div v-if='token._edit' class='ms-auto btn-list'>
                                <IconCheck @click='saveToken(token, tokenit)' class='cursor-pointer'/>
                                <IconTrash @click='deleteToken(token, tokenit)' class='cursor-pointer'/>
                            </div>
                            <div v-else class='ms-auto btn-list'>
                                <IconPencil @click='token._edit = true' class='cursor-pointer'/>
                            </div>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</div>
</template>

<script>
import {
    IconPlus,
    IconPencil,
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
            this.loading = true;
            this.list = await window.std('/api/token');
            this.loading = false;
        },
        saveToken: async function(token, tokenit) {
            if (token.id) {
                const newtoken = await window.std(`/api/token/${token.id}`, {
                    method: 'PATCH',
                    body: token
                });
                this.list.tokens.splice(tokenit, 1, newtoken);
            } else {
                const newtoken = await window.std('/api/token', {
                    method: 'POST',
                    body: token
                });
                this.list.tokens.splice(tokenit, 1, newtoken);
            }
        },
        deleteToken: async function(token, tokenit) {
            if (token.id) {
                const newtoken = await window.std(`/api/token/${token.id}`, {
                    method: 'DELETE',
                });
            }

            this.list.tokens.splice(tokenit, 1);
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
        TablerNone,
        IconPlus,
        IconPencil,
        IconCheck,
        IconTrash,
        TablerEpoch,
        TablerLoading,
        TablerInput
    }
}
</script>
