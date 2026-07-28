<template>
    <div>
        <div class='card-header'>
            <h3 class='card-title'>
                Core Events
            </h3>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetchList'
                />
            </div>
        </div>
        <div style='min-height: 20vh; margin-bottom: 61px'>
            <div class='mx-1 my-2'>
                <SearchSortFilter
                    v-model='paging.filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
                    :active-filters='paging.channel === undefined ? 0 : 1'
                    placeholder='Filter by name...'
                >
                    <template #sort-icon>
                        <template v-if='sort'>
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
                                <strong class='small text-uppercase text-secondary'>Filters</strong>
                                <button
                                    v-if='paging.channel !== undefined'
                                    type='button'
                                    class='btn btn-link btn-sm p-0'
                                    @click='paging.channel = undefined'
                                >
                                    Clear
                                </button>
                            </div>
                            <div class='px-3 pb-2 d-flex flex-column gap-2'>
                                <div>
                                    <div class='small text-uppercase text-secondary mb-1'>
                                        Channels
                                    </div>
                                    <div
                                        v-if='!channels.length'
                                        class='small text-secondary'
                                    >
                                        No channels available
                                    </div>
                                    <label
                                        v-for='channel in channels'
                                        :key='"channel-" + channel.bitpos'
                                        class='form-check mb-1'
                                    >
                                        <input
                                            class='form-check-input'
                                            type='checkbox'
                                            :checked='paging.channel === channel.bitpos'
                                            @change='toggleChannel(channel.bitpos)'
                                        >
                                        <span
                                            class='form-check-label'
                                            v-text='channel.name'
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </template>
                </SearchSortFilter>
            </div>

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading v-else-if='loading' />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Core Events'
                :create='false'
            />
            <div
                v-else
                class='d-flex flex-column gap-2 px-1 pb-5'
            >
                <template
                    v-for='event in list.items'
                    :key='event.id'
                >
                    <StandardCoreEvent
                        :event='event'
                        @click='toggle(event.id)'
                    />
                    <div
                        v-if='expanded === event.id'
                        class='border rounded p-3 mx-1'
                    >
                        <div class='datagrid mb-3'>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Creator
                                </div>
                                <div class='datagrid-content'>
                                    {{ event.username || (event.connection !== null ? `Connection #${event.connection}` : "—") }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Priority
                                </div>
                                <div class='datagrid-content text-capitalize'>
                                    {{ event.priority }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Type
                                </div>
                                <div class='datagrid-content font-monospace'>
                                    {{ event.type }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Created
                                </div>
                                <div class='datagrid-content'>
                                    {{ new Date(event.created).toLocaleString() }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Updated
                                </div>
                                <div class='datagrid-content'>
                                    {{ new Date(event.updated).toLocaleString() }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Ended
                                </div>
                                <div class='datagrid-content'>
                                    {{ event.ended ? new Date(event.ended).toLocaleString() : "Active" }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Location
                                </div>
                                <div class='datagrid-content'>
                                    {{ event.location || "—" }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Coordinates
                                </div>
                                <div class='datagrid-content font-monospace'>
                                    {{ event.geometry.coordinates[1] }}, {{ event.geometry.coordinates[0] }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    External ID
                                </div>
                                <div class='datagrid-content'>
                                    {{ event.external_id || "—" }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Editable
                                </div>
                                <div class='datagrid-content'>
                                    {{ event.editable ? "Yes" : "No" }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    Channels
                                </div>
                                <div class='datagrid-content'>
                                    {{ event.channels.length ? event.channels.join(", ") : "Not Shared" }}
                                </div>
                            </div>
                            <div class='datagrid-item'>
                                <div class='datagrid-title'>
                                    ID
                                </div>
                                <div class='datagrid-content font-monospace'>
                                    {{ event.id }}
                                </div>
                            </div>
                        </div>

                        <template v-if='event.remarks'>
                            <div class='subheader mb-1'>
                                Remarks
                            </div>
                            <pre class='border rounded p-2 mb-3'>{{ event.remarks }}</pre>
                        </template>

                        <div class='btn-list justify-content-end'>
                            <TablerDelete
                                displaytype='button'
                                label='Delete Event'
                                @delete='deleteEvent(event.id)'
                            />
                        </div>
                    </div>
                </template>
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
import { server } from '../../../std.ts';
import type { CoreEventList } from '../../../types.ts';
import TableFooter from '../../util/TableFooter.vue';
import StandardCoreEvent from '../../CloudTAK/util/StandardCoreEvent.vue';
import SearchSortFilter from '../../CloudTAK/util/SearchSortFilter.vue';
import {
    IconClock,
    IconArrowUp,
    IconArrowDown,
    IconArrowsSort,
    IconLetterCase,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerAlert,
    TablerDelete,
    TablerLoading,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';

type CoreEventSort = 'id' | 'created' | 'updated' | 'ended' | 'username' | 'connection' | 'priority' | 'type' | 'name' | 'external_id' | 'editable' | 'location' | 'remarks';

const error = ref<Error | undefined>(undefined);
const loading = ref(true);
const expanded = ref<string | undefined>(undefined);

const list = ref<CoreEventList>({ total: 0, items: [] });
const paging = ref({
    filter: '',
    channel: undefined as number | undefined,
    sort: 'created' as CoreEventSort,
    order: 'desc' as 'asc' | 'desc',
    limit: 100,
    page: 0
});

const sort = ref('');
const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'A → Z', 'Z → A'];

const sortTypeIcon = computed(() => (sort.value === 'A → Z' || sort.value === 'Z → A') ? IconLetterCase : IconClock);
const sortDirectionIcon = computed(() => (sort.value === 'Oldest → Newest' || sort.value === 'A → Z') ? IconArrowUp : IconArrowDown);

const channels = ref<Array<{ name: string, bitpos: number }>>([]);

watch(sort, () => {
    if (sort.value === 'Oldest → Newest') {
        paging.value.sort = 'created';
        paging.value.order = 'asc';
    } else if (sort.value === 'A → Z') {
        paging.value.sort = 'name';
        paging.value.order = 'asc';
    } else if (sort.value === 'Z → A') {
        paging.value.sort = 'name';
        paging.value.order = 'desc';
    } else {
        paging.value.sort = 'created';
        paging.value.order = 'desc';
    }
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await Promise.all([
        fetchList(),
        fetchChannels(),
    ]);
});

function toggleChannel(bitpos: number): void {
    paging.value.channel = paging.value.channel === bitpos ? undefined : bitpos;
}

async function fetchChannels(): Promise<void> {
    try {
        const res = await server.GET('/api/marti/group', {
            params: {
                query: {
                    useCache: true
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        const seen = new Set<number>();
        channels.value = res.data.data
            .filter((group) => {
                if (seen.has(group.bitpos)) return false;
                seen.add(group.bitpos);
                return true;
            })
            .map((group) => ({ name: group.name, bitpos: group.bitpos }))
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

function toggle(id: string): void {
    expanded.value = expanded.value === id ? undefined : id;
}

async function fetchList(): Promise<void> {
    try {
        loading.value = true;
        const res = await server.GET('/api/core/event', {
            params: {
                query: {
                    filter: paging.value.filter,
                    channel: paging.value.channel,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: paging.value.sort,
                    order: paging.value.order
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        list.value = res.data as CoreEventList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}

async function deleteEvent(eventid: string): Promise<void> {
    try {
        loading.value = true;
        const res = await server.DELETE('/api/core/event/{:event}', {
            params: {
                path: {
                    ':event': eventid
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
        expanded.value = undefined;
        await fetchList();
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
        loading.value = false;
    }
}
</script>
