<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Users
            </h1>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <TablerInput
                v-model='paging.filter'
                icon='search'
                placeholder='Filter...'
                class='mx-1 my-2'
            />

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                label='Users'
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
                    <tbody
                        role='menu'
                    >
                        <tr
                            v-for='user in list.items'
                            :key='user.username'
                            class='cursor-pointer'
                            role='menuitem'
                            tabindex='0'
                            @keyup.enter='router.push(`/admin/user/${user.username}`)'
                            @click='router.push(`/admin/user/${user.username}`)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display'>
                                    <td>
                                        <div
                                            v-if='h.name === "username"'
                                            class='d-flex align-items-center'
                                        >
                                            <StatusDot
                                                :dark='true'
                                                :status='user.active ? "Success" : "Unknown"'
                                            />
                                            <span
                                                class='mx-2'
                                                v-text='user[h.name]'
                                            />
                                        </div>
                                        <div
                                            v-else-if='h.name === "last_login"'
                                        >
                                            <div v-text='timeDiff(user[h.name])' />
                                            <div
                                                class='subheader'
                                                v-text='user[h.name]'
                                            />
                                        </div>
                                        <span
                                            v-else
                                            v-text='user[h.name]'
                                        />
                                    </td>
                                </template>
                            </template>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div
                class='position-absolute bottom-0 w-100'
                style='height: 61px;'
            >
                <TableFooter
                    :limit='paging.limit'
                    :total='list.total'
                    @page='paging.page = $event'
                />
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { std, stdurl } from '../../std.ts';
import timeDiff from '../../timediff.ts';
import type { User, UserList } from '../../types.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import StatusDot from '../util/StatusDot.vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';

const router = useRouter();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);

type Header = { name: keyof User, display: boolean };
const header = ref<Array<Header>>([])
const list = ref<UserList>({ total: 0, items: [] });
const paging = ref({
    filter: '',
    sort: 'last_login',
    order: 'desc',
    limit: 100,
    page: 0
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await listLayerSchema();
    await fetchList();
});

async function listLayerSchema() {
    const schema = await std('/api/schema?method=GET&url=/user');

    header.value = ['username', 'last_login', 'phone'].map((h) => {
        return { name: h, display: true } as Header;
    });

    // @ts-expect-error No strong types on Schema objects
    header.value.push(...schema.query.properties.sort.enum.map((h: string) => {
        return {
            name: h,
            display: false
        }
    }).filter((h: { name: string, display: boolean }) => {
        for (const hknown of header.value) {
            if (hknown.name === h.name) return false;
        }
        return true;
    }));
}

async function fetchList() {
    try {
        loading.value = true;
        const url = stdurl('/api/user');
        url.searchParams.append('filter', paging.value.filter);
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('page', String(paging.value.page));
        url.searchParams.append('sort', paging.value.sort);
        url.searchParams.append('order', paging.value.order);
        list.value = await std(url) as UserList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
