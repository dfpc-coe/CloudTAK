<template>
    <TablerLoading v-if='loading' />
    <TablerAlert
        v-else-if='err'
        :err='err'
    />
    <template v-else>
        <TablerNone
            v-if='!list.items.length'
            label='No Login Sessions'
            :create='false'
        />
        <div
            v-else
            class='col-12 d-flex flex-column gap-2 py-3'
        >
            <StandardItemProfileSession
                v-for='session in list.items'
                :key='session.id'
                :session='session'
            />
        </div>
        <TableFooter
            :limit='paging.limit'
            :total='list.total'
            :page='paging.page'
            @page='paging.page = $event'
        />
    </template>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { server } from '../../std.ts';
import StandardItemProfileSession from '../CloudTAK/util/StandardItemProfileSession.vue';
import TableFooter from './TableFooter.vue';
import {
    TablerNone,
    TablerLoading,
    TablerAlert,
} from '@tak-ps/vue-tabler';

const props = defineProps<{
    username: string;
}>();

interface Session {
    id: string;
    username: string;
    created: string;
    ip: string;
    device_type: string;
    browser: string;
    os: string;
    user_agent: string;
    active: boolean;
}

type SessionSort = 'id' | 'username' | 'created' | 'ip' | 'device_type' | 'browser' | 'os' | 'user_agent' | 'enableRLS';

const loading = ref(false);
const err = ref<Error | null>(null);
const list = ref<{ total: number; items: Session[] }>({ total: 0, items: [] });
const paging = ref({
    limit: 10,
    page: 0,
    sort: 'created' as SessionSort,
    order: 'desc' as 'asc' | 'desc',
});

onMounted(async () => {
    await fetchSessions();
});

watch(paging.value, () => {
    void fetchSessions();
});

async function fetchSessions(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const res = await server.GET('/api/user/{:username}/session', {
            params: {
                path: {
                    ':username': props.username,
                },
                query: {
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: paging.value.sort,
                    order: paging.value.order,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        list.value = res.data;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}
</script>
