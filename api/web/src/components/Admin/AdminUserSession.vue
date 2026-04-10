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
            <div
                v-if='!sessions.length'
                class='text-muted text-center py-2'
            >
                No login sessions recorded
            </div>
            <table
                v-else
                class='table table-sm table-vcenter'
            >
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>IP</th>
                        <th>Browser</th>
                        <th>OS</th>
                        <th>Device</th>
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for='session in sessions'
                        :key='session.id'
                    >
                        <td v-text='new Date(session.created).toLocaleString()' />
                        <td v-text='session.ip' />
                        <td v-text='session.browser' />
                        <td v-text='session.os' />
                        <td v-text='session.device_type' />
                    </tr>
                </tbody>
            </table>

            <div
                v-if='total > sessions.length'
                class='d-flex justify-content-center pt-2'
            >
                <button
                    class='btn btn-sm btn-secondary'
                    @click='fetchMore'
                >
                    Load More
                </button>
            </div>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch } from 'vue';
import { std, stdurl } from '../../std.ts';
import {
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
}

const isOpen = ref(false);
const loading = ref(false);
const err = ref<Error | null>(null);
const sessions = ref<Session[]>([]);
const total = ref(0);
const page = ref(0);

function toggle(): void {
    isOpen.value = !isOpen.value;
}

watch(isOpen, (newState) => {
    if (newState && !sessions.value.length) {
        page.value = 0;
        void fetchSessions();
    }
});

async function fetchSessions(): Promise<void> {
    loading.value = true;
    err.value = null;

    try {
        const url = stdurl(`/api/user/${encodeURIComponent(props.username)}/session`);
        url.searchParams.set('limit', '10');
        url.searchParams.set('page', String(page.value));

        const res = await std(url) as { total: number; items: Session[] };

        if (page.value === 0) {
            sessions.value = res.items;
        } else {
            sessions.value.push(...res.items);
        }

        total.value = res.total;
    } catch (error) {
        err.value = error instanceof Error ? error : new Error(String(error));
    }

    loading.value = false;
}

async function fetchMore(): Promise<void> {
    page.value++;
    await fetchSessions();
}
</script>
