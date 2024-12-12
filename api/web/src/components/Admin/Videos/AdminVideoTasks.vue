<template>
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
        <TablerLoading v-if='loading' />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
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

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../../../src/std.ts';
import Status from '../../util/Status.vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading
} from '@tak-ps/vue-tabler';
import {
    IconRefresh,
    IconPlus,
} from '@tabler/icons-vue'

const router = useRouter();

const error = ref<Error | undefined>();
const loading = ref(true)
const list = ref({
    total: 0,
    versions: [],
    items: []
});

onMounted(async () => {
    await fetchList()
})

async function fetchList() {
    loading.value = true;
    const url = stdurl('/api/video/server');
    list.value = await std(url);
    loading.value = false;
}

async function createServer() {
    loading.value = true;
    const url = stdurl('/api/video/server');
    const server = await std(url, {
        method: 'POST',
        body: {}
    });

    router.push(`/admin/video/${server.id}`);
}
</script>
