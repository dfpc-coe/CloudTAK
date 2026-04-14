<template>
    <div
        class='col-lg-12 cloudtak-hover py-2 mt-2 cursor-pointer'
        @click='toggle'
    >
        <IconChevronDown v-if='isOpen' />
        <IconChevronRight v-else />

        <span class='mx-2 user-select-none'>Login Sessions</span>
    </div>
    <div
        v-if='isOpen'
        class='col-lg-12 card-body border rounded'
    >
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
                class='table-responsive'
            >
                <table class='table card-table table-hover table-vcenter datatable'>
                    <TableHeader
                        v-model:sort='paging.sort'
                        v-model:order='paging.order'
                        v-model:header='header'
                    />
                    <tbody>
                        <tr
                            v-for='session in list.items'
                            :key='session.id'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <div
                                            v-if='h.name === "created"'
                                            class='d-flex align-items-center'
                                        >
                                            <StatusDot
                                                :dark='true'
                                                :status='session.active ? "Success" : "Unknown"'
                                            />
                                            <span
                                                class='mx-2'
                                                v-text='new Date(session.created).toLocaleString()'
                                            />
                                        </div>
                                        <span
                                            v-else
                                            v-text='session[h.name]'
                                        />
                                    </td>
                                </template>
                            </template>
                        </tr>
                    </tbody>
                </table>
            </div>
            <TableFooter
                :limit='paging.limit'
                :total='list.total'
                @page='paging.page = $event'
            />
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import { std, stdurl } from '../../std.ts';
import TableHeader from '../util/TableHeader.vue';
import TableFooter from '../util/TableFooter.vue';
import StatusDot from '../util/StatusDot.vue';
import {
    TablerNone,
    TablerLoading,
    TablerAlert,
} from '@tak-ps/vue-tabler';
import {
    IconChevronDown,
    IconChevronRight,
} from '@tabler/icons-vue';

const props = defineProps<{
    username: string;
}>();

interface Session {
    id: number;
    username: string;
    created: string;
    ip: string;
    device_type: string;
    browser: string;
    os: string;
    user_agent: string;
    active: boolean;
    [key: string]: unknown;
}

type Header = { name: string & keyof Session; display: boolean };

const isOpen = ref(false);
const loading = ref(false);
const err = ref<Error | null>(null);
const list = ref<{ total: number; items: Session[] }>({ total: 0, items: [] });
const header = ref<Header[]>([
    { name: 'created', display: true },
    { name: 'ip', display: true },
    { name: 'browser', display: true },
    { name: 'os', display: true },
    { name: 'device_type', display: true },
]);
const paging = ref({
    limit: 10,
    page: 0,
    sort: 'created',
    order: 'desc',
});

function toggle(): void {
    isOpen.value = !isOpen.value;
}

watch(isOpen, (newState) => {
    if (newState && !list.value.items.length) {
        paging.value.page = 0;
        void fetchSessions();
    }
});

watch(paging.value, () => {
    void fetchSessions();
});

async function fetchSessions(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const url = stdurl(`/api/user/${encodeURIComponent(props.username)}/session`);
        url.searchParams.set('limit', String(paging.value.limit));
        url.searchParams.set('page', String(paging.value.page));
        url.searchParams.set('sort', paging.value.sort);
        url.searchParams.set('order', paging.value.order);

        list.value = await std(url) as { total: number; items: Session[] };
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}
</script>
