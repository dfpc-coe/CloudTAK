<template>
    <div>
        <div class='card-header d-flex'>
            <h1 class='card-title'>
                Connection Admin
            </h1>

            <div class='ms-auto btn-list'>
                <TablerIconButton
                    title='Create Connection'
                    @click='navTo("/connection/new")'
                >
                    <IconPlus
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <TablerIconButton
                    title='Reconnect All'
                    :disabled='loading'
                    @click='reconnectConnections'
                >
                    <IconPlugConnected
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

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
            <TablerLoading
                v-if='loading'
                desc='Loading Connections'
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='No Layers'
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
                            v-for='connection in list.items'
                            :key='connection.id'
                            class='cursor-pointer'
                            role='menuitem'
                            tabindex='0'
                            @keyup.enter='navTo(`/connection/${connection.id}`, $event)'
                            @click='navTo(`/connection/${connection.id}`, $event)'
                        >
                            <template v-for='h in header'>
                                <template v-if='h.display && h.name === "name"'>
                                    <td>
                                        <div class='d-flex flex-wrap align-items-center gap-2'>
                                            <Status :connection='connection' />
                                            <span
                                                class='mx-2'
                                                v-text='connection[h.name]'
                                            />
                                            <div class='ms-auto d-flex align-items-center gap-2'>
                                                <TablerBadge
                                                    v-if='certificateStatus(connection) === "expired"'
                                                    background-color='rgba(220, 38, 38, 0.15)'
                                                    border-color='rgba(220, 38, 38, 0.35)'
                                                    text-color='#b91c1c'
                                                >
                                                    Expired
                                                </TablerBadge>
                                                <TablerBadge
                                                    v-else-if='certificateStatus(connection) === "near-expiry"'
                                                    background-color='rgba(249, 115, 22, 0.15)'
                                                    border-color='rgba(249, 115, 22, 0.35)'
                                                    text-color='#c2410c'
                                                >
                                                    Near Expiry
                                                </TablerBadge>
                                            </div>
                                        </div>
                                    </td>
                                </template>
                                <template v-else-if='h.display'>
                                    <td>
                                        <span v-text='connection[h.name]' />
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

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { openSecondaryView } from '../../base/capacitor.ts';
import { server } from '../../std.ts';
import type { paths } from '@cloudtak/api-types';
import TableHeader from '../util/TableHeader.vue'
import TableFooter from '../util/TableFooter.vue'
import Status from '../ETL/Connection/StatusDot.vue';
import {
    TablerNone,
    TablerAlert,
    TablerBadge,
    TablerInput,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconPlugConnected,
    IconPlus,
} from '@tabler/icons-vue'

const error = ref<Error | boolean>(false);
const loading = ref<boolean>(true);
const header = ref<{ name: ConnectionItemKey; display: boolean }[]>([]);

type ConnectionQuery = paths['/api/connection']['get']['parameters']['query'];
type ConnectionResponse = paths['/api/connection']['get']['responses']['200']['content']['application/json'];
type ConnectionItem = ConnectionResponse['items'][number];
type ConnectionItemKey = keyof ConnectionItem;
type ConnectionCertificate = {
    validTo?: string | null;
};

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const paging = ref<{
    filter: string;
    sort: ConnectionQuery['sort'];
    order: ConnectionQuery['order'];
    limit: number;
    page: number;
}>({
    filter: '',
    sort: 'name',
    order: 'asc',
    limit: 100,
    page: 0
})

const list = ref<ConnectionResponse>({
    total: 0,
    status: {
        dead: 0,
        live: 0,
        unknown: 0,
    },
    items: []
})

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
                url: '/connection'
            }
        }
    });
    if (res.error) throw new Error(res.error.message);

    const schema = res.data as {
        query: {
            properties: {
                sort: { enum: ConnectionItemKey[] };
            };
        };
    };

    header.value = (['id', 'name'] satisfies ConnectionItemKey[]).map((h) => {
        return { name: h, display: true };
    });

    header.value.push(...schema.query.properties.sort.enum.map((h) => {
        return {
            name: h,
            display: false
        }
    }).filter((h) => {
        for (const hknown of header.value) {
            if (hknown.name === h.name) return false;
        }
        return true;
    }));
}

async function reconnectConnections() {
    loading.value = true;
    error.value = false;
    try {
        const res = await server.POST('/api/connection/refresh');
        if (res.error) throw new Error(res.error.message);

        await fetchList();
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

function navTo(path: string, event?: MouseEvent | KeyboardEvent) {
    if (event?.ctrlKey) {
        void openSecondaryView(path);
    } else {
        window.location.href = path;
    }
}

function certificateExpiryState(validTo?: string | null): 'expired' | 'near-expiry' | null {
    if (!validTo) return null;

    const expiry = Date.parse(validTo);
    if (Number.isNaN(expiry)) return null;

    const remaining = expiry - Date.now();
    if (remaining < 0) return 'expired';
    if (remaining <= TWO_WEEKS_MS) return 'near-expiry';

    return null;
}

function certificateStatus(connection: ConnectionItem) {
    const certificate = (connection as ConnectionItem & { certificate?: ConnectionCertificate }).certificate;
    return certificateExpiryState(certificate?.validTo);
}

async function fetchList() {
    loading.value = true;

    try {
        const res = await server.GET('/api/connection', {
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

        list.value = res.data;

        loading.value = false;
    } catch (err) {
        loading.value = false;
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}


</script>
