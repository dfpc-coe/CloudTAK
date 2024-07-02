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
                    @click='lease={}'
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
            <table class='table table-hover card-table table-vcenter'>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Lease Path</th>
                        <th>Updated</th>
                        <th>Lease Expiration</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='t in list.items'
                        :key='t.id'
                    >
                        <td v-text='t.name' />
                        <td
                            class='subheader'
                            v-text='`/${t.path}`'
                        />
                        <td><TablerEpoch :date='t.updated' /></td>
                        <td><TablerEpoch :date='t.expiration' /></td>
                    </tr>
                </tbody>
            </table>
        </div>

        <VideoLeaseModal
            v-if='lease'
            :lease='lease'
            @close='lease = false'
            @refresh='fetch'
        />
    </div>
</template>

<script>
import { std } from '/src/std.ts';
import VideoLeaseModal from './VideoLeaseModal.vue';
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
        VideoLeaseModal,
        TablerNone,
        IconPlus,
        IconRefresh,
        TablerEpoch,
        TablerLoading,
    },
    data: function() {
        return {
            loading: true,
            lease: false,
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
            this.lease = false;
            this.loading = true;
            this.list = await std('/api/video/lease');
            this.loading = false;
        },
    }
}
</script>
