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
            <SearchSortFilter
                v-model='paging.filter'
                class='mx-1 my-2'
                placeholder='Filter...'
                :sort='sortOption'
                :sort-options='sortOptions'
                :active-filters='activeFilterCount'
                @update:sort='applySortOption($event)'
            >
                <template #sort-icon>
                    <template v-if='sortOption'>
                        <component
                            :is='sortTypeIcon'
                            :size='20'
                            stroke='1'
                        />
                        <component
                            :is='sortDirectionIcon'
                            :size='20'
                            stroke='1'
                        />
                    </template>
                    <IconArrowsSort
                        v-else
                        :size='20'
                        stroke='1'
                    />
                </template>
                <template #filters>
                    <div class='d-flex flex-column'>
                        <div class='d-flex align-items-center justify-content-between px-3 py-2'>
                            <strong class='small text-uppercase text-white-50'>Filters</strong>
                            <button
                                v-if='activeFilterCount > 0'
                                type='button'
                                class='btn btn-link btn-sm p-0'
                                @click='clearFilters'
                            >
                                Clear
                            </button>
                        </div>
                        <div class='px-3 pb-2 d-flex flex-column gap-2'>
                            <div>
                                <div class='small text-uppercase text-white-50 mb-1'>
                                    Status
                                </div>
                                <label class='form-check mb-1'>
                                    <input
                                        class='form-check-input'
                                        type='checkbox'
                                        :checked='paging.disabled === true'
                                        @change='paging.disabled = paging.disabled === true ? undefined : true'
                                    >
                                    <span class='form-check-label'>Disabled</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </template>
            </SearchSortFilter>

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Users'
                :create='false'
            />
            <div
                v-else
                class='table-responsive pb-5'
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
                            @keyup.enter='stdclick(router, $event, `/admin/user/${user.username}`)'
                            @click='stdclick(router, $event, `/admin/user/${user.username}`)'
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
                                            <div class='mx-2'>
                                                <div v-text='user.name' />
                                                <div
                                                    class='subheader'
                                                    v-text='user.username'
                                                />
                                            </div>
                                            <CertificateBadge
                                                class='ms-auto'
                                                :certificate='user.certificate'
                                            />
                                        </div>
                                        <div
                                            v-else-if='h.name === "last_login"'
                                        >
                                            <template v-if='user.last_login'>
                                                <div v-text='timeDiff(user.last_login)' />
                                                <div
                                                    class='subheader'
                                                    v-text='user.last_login'
                                                />
                                            </template>
                                            <div
                                                v-else
                                                class='subheader'
                                            >
                                                Never
                                            </div>
                                        </div>
                                        <span
                                            v-else
                                            v-text='(user as Partial<User>)[h.name]'
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
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { server, stdclick } from '../../std.ts';
import timeDiff from '../../timediff.ts';
import type { User, UserList } from '../../types.ts';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import StatusDot from '../util/StatusDot.vue';
import CertificateBadge from '../util/CertificateBadge.vue';
import SearchSortFilter from '../CloudTAK/util/SearchSortFilter.vue';
import {
    IconLetterCase,
    IconClock,
    IconArrowUp,
    IconArrowDown,
    IconArrowsSort,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerLoading,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';

const router = useRouter();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);

type Header = { name: keyof User, display: boolean };
type UserSort = 'id' | 'name' | 'username' | 'last_login' | 'auth' | 'created' | 'updated' | 'system_admin' | 'agency_admin' | 'disabled';
type UserOrder = 'asc' | 'desc';

const sortOptionMap: Record<string, { sort: UserSort; order: UserOrder }> = {
    'Last Login: Newest → Oldest': { sort: 'last_login', order: 'desc' },
    'Last Login: Oldest → Newest': { sort: 'last_login', order: 'asc' },
    'Name: A → Z': { sort: 'name', order: 'asc' },
    'Name: Z → A': { sort: 'name', order: 'desc' },
};
const sortOptions = Object.keys(sortOptionMap);

const header = ref<Array<Header>>([])
const list = ref<UserList>({ total: 0, items: [] });
const paging = ref({
    filter: '',
    disabled: undefined as boolean | undefined,
    sort: 'last_login' as UserSort,
    order: 'desc' as UserOrder,
    limit: 100,
    page: 0
});

// The table header can sort by any column - only the sort options above are named in the dropdown
const sortOption = computed<string>(() => {
    return sortOptions.find((option) => {
        return sortOptionMap[option].sort === paging.value.sort && sortOptionMap[option].order === paging.value.order;
    }) ?? '';
});

const sortTypeIcon = computed(() => paging.value.sort === 'name' ? IconLetterCase : IconClock);
const sortDirectionIcon = computed(() => paging.value.order === 'asc' ? IconArrowUp : IconArrowDown);

function applySortOption(option: string): void {
    const selected = sortOptionMap[option];
    if (!selected) return;
    paging.value.sort = selected.sort;
    paging.value.order = selected.order;
}

const activeFilterCount = computed<number>(() => {
    return paging.value.disabled === undefined ? 0 : 1;
});

function clearFilters(): void {
    paging.value.disabled = undefined;
}

watch(() => [paging.value.filter, paging.value.disabled, paging.value.sort, paging.value.order], () => {
    // A new filter invalidates the current page offset - the page watcher below refetches
    if (paging.value.page !== 0) paging.value.page = 0;
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await listLayerSchema();
    await fetchList();
});

async function listLayerSchema() {
    const res = await server.GET('/api/schema', {
        params: {
            query: {
                method: 'GET',
                url: '/user'
            }
        }
    });

    if (res.error) throw new Error(res.error.message);
    const schema = res.data;

    header.value = ['username', 'last_login'].map((h) => {
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
        const res = await server.GET('/api/user', {
            params: {
                query: {
                    filter: paging.value.filter,
                    disabled: paging.value.disabled,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: paging.value.sort,
                    order: paging.value.order
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        list.value = res.data as UserList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
