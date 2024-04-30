<template>
<div>
    <div class="card-header">
        <h1 class='card-title'>Video Servers</h1>

        <div class='ms-auto btn-list'>
            <IconRefresh
                @click='fetchList'
                v-tooltip='"Refresh"'
                size='32'
                class='cursor-pointer'
            />
        </div>
    </div>
    <div>
        <TablerLoading v-if='loading'/>
        <TablerNone v-else-if='!list.items.length' label='Video Servers' :create='false' />
        <div v-else class='table-responsive'>
            <table class="table card-table table-hover table-vcenter datatable">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Version</th>
                        <th>Created</th>
                        <th>Status</th>
                        <th>CPU</th>
                        <th>Memory</th>
                    </tr>
                </thead>
                <tbody>
                    <tr @click='$router.push(`/admin/video/${server.id}`)' :key='server.id' v-for='server in list.items' class='cursor-pointer'>
                        <td v-text='server.id'></td>
                        <td v-text='server.version'></td>
                        <td v-text='server.created'></td>
                        <td v-text='server.status'></td>
                        <td v-text='server.cpu'></td>
                        <td v-text='server.memory'></td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
} from '@tabler/icons-vue'

export default {
    name: 'VideoAdmin',
    data: function() {
        return {
            err: false,
            loading: true,
            header: [],
            list: {
                total: 0,
                items: []
            }
        }
    },
    mounted: async function() {
        await this.fetchList();
    },
    methods: {
        fetchList: async function() {
            this.loading = true;
            const url = stdurl('/api/video');
            this.list = await std(url);
            this.loading = false;
        }
    },
    components: {
        TablerNone,
        IconRefresh,
        TablerLoading,
        TableHeader,
        TableFooter,
    }
}
</script>
