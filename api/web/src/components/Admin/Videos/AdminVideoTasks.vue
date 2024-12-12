<template>
    <div class='card-header'>
        <h1 class='card-title'>
            Video Service
        </h1>

        <div class='ms-auto btn-list'>
            <IconSettings
                v-if='disabled'
                v-tooltip='"Edit"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='disabled = !disabled'
            />
            <IconRefresh
                v-tooltip='"Refresh"'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='fetchService'
            />
        </div>
    </div>
    <div
        class='px-2 py-2 round btn-group w-100'
        role='group'
    >
        <input
            id='service'
            type='radio'
            class='btn-check'
            autocomplete='off'
            :checked='route.name === "admin-video-service"'
            @click='router.push({ name: `admin-video-service` })'
        >
        <label
            for='service'
            type='button'
            class='btn btn-sm'
        ><IconVideo
            v-tooltip='"Video Service"'
            :size='32'
            stroke='1'
        />Video Service</label>

        <input
            id='tasks'
            type='radio'
            class='btn-check'
            autocomplete='off'
            :checked='mode === "tasks"'
            @click='mode = "tasks"'
        >

        <label
            for='tasks'
            type='button'
            class='btn btn-sm'
        ><IconServer2
            v-tooltip='"Video Tasks"'
            :size='32'
            stroke='1'
        /></label>
    </div>

    <router-view/>

    <template v-if='disabled'>
        <div class='card-header'>
            <h1 class='card-title'>
                Individual Video Servers
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
            <TablerLoading v-if='loading.tasks' />
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
    </template>
</template>

<script>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { std, stdurl } from '/src/std.ts';
import Status from '../util/Status.vue';
import VideoConfig from './VideoConfig.vue';
import {
    TablerNone,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconVideo,
    IconRefresh,
    IconSettings,
    IconPlus,
} from '@tabler/icons-vue'

const router = useRouter();
const route = useRoute();

/*
export default {
    name: 'VideoAdmin',
    components: {
        IconVideo,
        VideoConfig,
        TablerNone,
        Status,
        IconRefresh,
        IconSettings,
        IconPlus,
        TablerLoading,
    },
    data: function() {
        return {
            err: false,
            disabled: true,
            loading: {
                main: true,
                service: true,
                tasks: true
            },
            header: [],
            service: {
                configured: false
            },
            list: {
                total: 0,
                versions: [],
                items: []
            }
        }
    },
    mounted: async function() {
        this.loading.main = true;
        await Promise.all([
            this.fetchList(),
            this.fetchService()
        ])
        this.loading.main = false;
    },
    methods: {
        fetchService: async function() {
            this.loading.service = true;
            const url = stdurl('/api/video/service');
            this.service = await std(url);
            this.loading.service = false;
        },
        fetchList: async function() {
            this.loading.tasks = true;
            const url = stdurl('/api/video/server');
            this.list = await std(url);
            this.loading.tasks = false;
        },
        createServer: async function() {
            this.loading.main = true;
            const url = stdurl('/api/video/server');
            const server = await std(url, {
                method: 'POST',
                body: {}
            });

            this.$router.push(`/admin/video/${server.id}`);
        }
    }
}
*/
</script>
