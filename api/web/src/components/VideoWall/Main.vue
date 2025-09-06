<template>
    <div class='h-full w-full bg-dark text-white'>
        <div
            v-if='loading'
        >
            <TablerLoading/>
        </div>
        <div
            v-else-if='error'
        >
            <TablerAlert
                :err='error'
            />
        </div>
        <div
            v-else-if='list.total === 0'
        >
            <TablerNone
                label='Video Sources Configured'
                :create='false'
            />
        </div>
        <template v-else>
            <span v-text='list'/>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import { server } from '../../std.ts';
import type { ProfileVideoList } from '../../types.ts';
import {
    TablerNone,
    TablerLoading,
    TablerAlert,
} from '@tak-ps/vue-tabler';

const loading = ref(true);
const error = ref<Error | undefined>();

const list = ref<ProfileVideoList>({
    total: 0,
    items: []
});

const paging = ref<{
    page: number;
    limit: number;
    order: 'asc' | 'desc';
}>({
    page: 0,
    limit: 20,
    order: 'desc'
});

onMounted(async () => {
    await listVideos();
});

async function listVideos() {
    try {
        const res = await server.GET('/api/profile/video', {
            params: {
                query: paging.value
            }
        })

        loading.value = false;
        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}


</script>
