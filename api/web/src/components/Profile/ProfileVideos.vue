<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Video Server Leases
            </h3>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-tooltip='"New Lease"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='token={}'
                />
                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetch'
                />
            </div>
        </div>

        <TablerNone
            v-if='!list.items.length'
            :create='false'
            label='Leases'
        />
        <TablerLoading v-else-if='loading' />
        <div
            v-else
            class='table-responsive'
        >
            <table class='table table-hover card-table table-vcenter cursor-pointer'>
                <thead>
                    <tr>
                        <th>Lease Path</th>
                        <th>Created</th>
                        <th>Updated</th>
                        <th>Lease Expiration</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='t in list.items'
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
    name: 'ProfileVideos',
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
            list: {
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
            this.list = await std('/api/video/lease');
            this.loading = false;
        },
    }
}
</script>
