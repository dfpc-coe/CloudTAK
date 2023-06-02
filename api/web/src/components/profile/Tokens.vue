<template>
<div class="card">
    <div class="card-body">
        <div class="d-flex">
            <h3 class="card-title">API Tokens</h3>

            <div class='ms-auto btn-list'>
                <PlusIcon @click='push()' class='cursor-pointer'/>
            </div>
        </div>
    </div>

    <None v-if='!list.tokens.length' :create='false' label='Tokens'/>
    <TablerLoading v-else-if='loading'/>
    <table v-else class="table card-table table-vcenter">
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
                            <CheckIcon @click='saveToken(token, tokenit)' class='cursor-pointer'/>
                            <TrashIcon @click='deleteToken(token, tokenit)' class='cursor-pointer'/>
                        </div>
                        <div v-else class='ms-auto btn-list'>
                            <PencilIcon @click='token._edit = true' class='cursor-pointer'/>
                        </div>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>
</div>
</template>

<script>
import {
    PlusIcon,
    PencilIcon,
    CheckIcon,
    TrashIcon
} from 'vue-tabler-icons';
import {
    TablerEpoch,
    TablerLoading,
    TablerInput
} from '@tak-ps/vue-tabler';
import None from '../cards/None.vue';

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
        None,
        PlusIcon,
        PencilIcon,
        CheckIcon,
        TrashIcon,
        TablerEpoch,
        TablerLoading,
        TablerInput
    }
}
</script>
