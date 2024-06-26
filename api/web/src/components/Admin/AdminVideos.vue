<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Video Servers
            </h1>

            <div class='ms-auto btn-list'>
                <IconPlus
                    v-if='list.versions.length'
                    v-tooltip='"Create Server"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='createServer'
                />

                <IconRefresh
                    v-tooltip='"Refresh"'
                    :size='32'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='fetchList'
                />
            </div>
        </div>
        <div>
            <TablerLoading v-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                label='Video Servers'
                :create='false'
            />
            <div
                v-else
                class='table-responsive'
            >
                <table class='table card-table table-hover table-vcenter datatable'>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Version</th>
                            <th>Created</th>
                            <th>CPU</th>
                            <th>Memory</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for='server in list.items'
                            :key='server.id'
                            class='cursor-pointer'
                            @click='$router.push(`/admin/video/${server.id}`)'
                        >
                            <td class='d-flex align-items-center'>
                                <Status
                                    v-if='server.status === "RUNNING"'
                                    status='Success'
                                />
                                <Status
                                    v-else
                                    :status='server.status'
                                />
                                <span
                                    class='mx-2'
                                    v-text='server.id'
                                />
                            </td>
                            <td v-text='server.version' />
                            <td v-text='server.created' />
                            <td v-text='server.cpu' />
                            <td v-text='server.memory' />
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import Status from '../util/Status.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconPlus,
} from '@tabler/icons-vue'

export default {
    name: 'VideoAdmin',
    components: {
        TablerNone,
        Status,
        IconRefresh,
        IconPlus,
        TablerLoading,
    },
    data: function() {
        return {
            err: false,
            loading: true,
            header: [],
            list: {
                total: 0,
                versions: [],
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
            const url = stdurl('/api/video/server');
            this.list = await std(url);
            this.loading = false;
        },
        createServer: async function() {
            this.loading = true;
            const url = stdurl('/api/video/server');
            const server = await std(url, {
                method: 'POST',
                body: {}
            });
            
            this.$router.push(`/admin/video/${server.id}`);
        }
    }
}
</script>
