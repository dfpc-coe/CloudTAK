<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                TAK Server Videos
            </h3>
            <div class='ms-auto'>
                <div class='btn-list'>
                    <TablerRefreshButton
                        :loading='loading'
                        @click='fetchList'
                    />
                </div>
            </div>
        </div>
        <TablerLoading v-if='loading' />
        <TablerAlert
            v-else-if='error'
            :err='error'
        />
        <div
            v-else
            class='card-body row'
        >
            <TablerNone
                v-if='list.videoConnections.length === 0'
                label='Videos'
                :create='false'
            />
            <template v-else>
                <template v-for='video in list.videoConnections'>
                    <div class='col-12 hover d-flex align-items-center px-2 py-2 rounded'>
                        <div class='row'>
                            <div class='col-12'>
                                <span v-text='video.alias' />
                            </div>
                        </div>
                        <div class='ms-auto' />
                    </div>
                </template>
            </template>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { server } from '../../../std.ts';
import type { ServerAdminVideoList } from '../../../types.ts';
import {
    TablerRefreshButton,
    TablerLoading,
    TablerAlert,
    TablerNone,
} from '@tak-ps/vue-tabler';

const loading = ref(true);
const error = ref<Error | undefined>();
const list = ref<ServerAdminVideoList>({
    videoConnections: []
})

onMounted(async () => {
    await fetchList();
});

async function fetchList() {
    loading.value = true;
    error.value = undefined;

    try {
        const res = await server.GET(`/api/server/video`);

        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>
