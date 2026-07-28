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
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter by name...'
                />
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
import { ref, watch, onMounted } from 'vue';
import { server } from '../../../std.ts';
import type { CoreEventList } from '../../../types.ts';
import TableFooter from '../../util/TableFooter.vue';
import StandardCoreEvent from '../../CloudTAK/util/StandardCoreEvent.vue';
import {
    TablerNone,
    TablerAlert,
    TablerInput,
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
    sort: 'created' as CoreEventSort,
    order: 'desc' as 'asc' | 'desc',
    limit: 100,
    page: 0
});

watch(paging.value, async () => {
    await fetchList();
});

onMounted(async () => {
    await fetchList();
});

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
