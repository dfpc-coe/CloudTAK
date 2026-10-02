<template>
    <div>
        <div class='card-header'>
            <h1 class='card-title'>
                Overview
            </h1>

            <div class='ms-auto btn-list'>
                <TablerRefreshButton
                    :loading='loading'
                    @click='fetch'
                />
            </div>
        </div>
        <div class='card-body'>
            <StandardItem
                class='user-select-none px-3 py-3 mb-3'
                :class='takserverStatus.border'
                data-overview='takserver'
                @click='router.push("/admin/server")'
            >
                <TablerLoading
                    v-if='!takserver && !takserverError'
                    :compact='true'
                />
                <div
                    v-else
                    class='d-flex align-items-center'
                >
                    <StatusDot
                        :status='takserverStatus.dot'
                        :title='takserverStatus.label'
                    />
                    <div
                        class='ms-3'
                        style='min-width: 0'
                    >
                        <div class='fw-bold'>
                            TAK Server
                        </div>
                        <div
                            v-if='takserverError'
                            class='text-danger small'
                            v-text='takserverError.message'
                        />
                        <div
                            v-else-if='takserver'
                            class='text-secondary text-truncate'
                        >
                            <span v-text='takserverStatus.label' />
                            <span
                                v-if='takserver.name'
                                class='ms-1'
                                v-text='`- ${takserver.name}`'
                            />
                            <span
                                v-if='takserver.url'
                                class='ms-1'
                                v-text='`(${takserver.url})`'
                            />
                        </div>
                    </div>
                    <div
                        v-if='takserver && takserver.certificate'
                        class='ms-auto text-secondary small text-end'
                    >
                        <div>Certificate Expires</div>
                        <div v-text='new Date(takserver.certificate.validTo).toLocaleDateString()' />
                    </div>
                </div>
            </StandardItem>

            <div class='row g-2 mb-3'>
                <div
                    v-for='service in services'
                    :key='service.label'
                    class='col-12 col-sm-6 col-lg'
                >
                    <StandardItem
                        class='user-select-none d-flex flex-column align-items-center text-center px-3 py-4 h-100'
                        :class='{
                            "border-success": service.configured === true,
                            "border-danger": service.configured === false
                        }'
                        data-overview='service'
                        @click='router.push(service.to)'
                    >
                        <component
                            :is='service.icon'
                            :size='48'
                            stroke='1'
                        />
                        <div
                            class='fw-bold mt-2'
                            v-text='service.label'
                        />
                        <div
                            v-if='service.error'
                            class='text-danger small'
                            v-text='service.error'
                        />
                        <template v-else>
                            <div
                                :class='{
                                    "text-success": service.configured === true,
                                    "text-danger": service.configured === false
                                }'
                                v-text='service.configured === undefined ? "-" : service.configured ? "Configured" : "Not Configured"'
                            />
                            <div
                                v-if='service.detail'
                                class='text-secondary small'
                                v-text='service.detail'
                            />
                        </template>
                    </StandardItem>
                </div>
            </div>

            <div class='row g-2'>
                <div
                    v-for='tile in tiles'
                    :key='tile.to'
                    class='col-12 col-sm-6 col-lg-4'
                >
                    <StandardItem
                        class='user-select-none d-flex align-items-center px-3 py-3'
                        data-overview='tile'
                        @click='router.push(tile.to)'
                    >
                        <component
                            :is='tile.icon'
                            :size='32'
                            stroke='1'
                        />
                        <div class='ms-3'>
                            <div
                                class='h2 mb-0'
                                :title='tile.error'
                                v-text='tile.total === undefined ? "-" : tile.total.toLocaleString()'
                            />
                            <div
                                class='text-secondary'
                                v-text='tile.label'
                            />
                        </div>
                    </StandardItem>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted, markRaw } from 'vue';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import { server } from '../../std.ts';
import type { Server } from '../../types.ts';
import StatusDot from '../util/StatusDot.vue';
import StandardItem from '../CloudTAK/util/StandardItem.vue';
import {
    TablerLoading,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import {
    IconBug,
    IconFence,
    IconRoute,
    IconUsers,
    IconVideo,
    IconNetwork,
    IconMapSearch,
    IconFileImport,
    IconUsersGroup,
    IconBrandDocker,
    IconBuildingBroadcastTower,
} from '@tabler/icons-vue';

type Tile = {
    label: string;
    to: string;
    icon: Component;
    total?: number;
    error?: string;
    fetch: () => Promise<{ data?: { total: number }, error?: { message: string } }>;
};

type Service = {
    label: string;
    to: string;
    icon: Component;
    configured?: boolean;
    detail?: string;
    error?: string;
    fetch: () => Promise<{ configured: boolean, detail?: string }>;
};

const router = useRouter();

const paging = { limit: 1, page: 0, order: 'desc' as const, sort: 'id' as const, filter: '' };

const geofenceStates: Record<string, string> = {
    connected: 'Connected',
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    closing: 'Closing',
    error: 'Connection Error',
    disconnected: 'Disconnected',
    disabled: 'Disabled'
};

const loading = ref(true);
const takserver = ref<Server | undefined>(undefined);
const takserverError = ref<Error | undefined>(undefined);

const services = ref<Service[]>([{
    label: 'Video Server',
    to: '/admin/video',
    icon: markRaw(IconVideo),
    fetch: async () => {
        const [config, leases] = await Promise.all([
            fetchConfig(['media::url']),
            server.GET('/api/video/lease', {
                params: { query: { ...paging, impersonate: true, expired: 'false', ephemeral: 'all' } }
            })
        ]);

        if (leases.error) throw new Error(leases.error.message);

        const total = leases.data.total;

        return {
            configured: !!config['media::url'],
            detail: `${total.toLocaleString()} Active ${total === 1 ? 'Lease' : 'Leases'}`
        };
    }
}, {
    label: 'SCIM',
    to: '/admin/config',
    icon: markRaw(IconUsersGroup),
    fetch: async () => {
        const config = await fetchConfig(['scim::enabled', 'scim::token']);

        return { configured: !!config['scim::enabled'] && !!config['scim::token'] };
    }
}, {
    label: 'GeoFence Server',
    to: '/admin/geofence',
    icon: markRaw(IconFence),
    fetch: async () => {
        const res = await server.GET('/api/geofence');
        if (res.error) throw new Error(res.error.message);

        return {
            configured: res.data.configured,
            detail: res.data.configured ? geofenceStates[res.data.state] : undefined
        };
    }
}, {
    label: 'Search & Geocoding',
    to: '/admin/config',
    icon: markRaw(IconMapSearch),
    fetch: async () => {
        const res = await server.GET('/api/search');
        if (res.error) throw new Error(res.error.message);

        const providers = new Set([
            ...res.data.forward.providers,
            ...res.data.reverse.providers
        ].map(provider => provider.name));

        return {
            configured: providers.size > 0,
            detail: Array.from(providers).join(', ') || undefined
        };
    }
}, {
    label: 'Routing',
    to: '/admin/config',
    icon: markRaw(IconRoute),
    fetch: async () => {
        const res = await server.GET('/api/search');
        if (res.error) throw new Error(res.error.message);

        return {
            configured: res.data.route.providers.length > 0,
            detail: res.data.route.providers.map(provider => provider.name).join(', ') || undefined
        };
    }
}]);

const tiles = ref<Tile[]>([{
    label: 'Users',
    to: '/admin/user',
    icon: markRaw(IconUsers),
    fetch: () => server.GET('/api/user', { params: { query: paging } })
}, {
    label: 'Connections',
    to: '/admin/connection',
    icon: markRaw(IconNetwork),
    fetch: () => server.GET('/api/connection', { params: { query: paging } })
}, {
    label: 'Layers',
    to: '/admin/layer',
    icon: markRaw(IconBuildingBroadcastTower),
    fetch: () => server.GET('/api/layer', { params: { query: { ...paging, alarms: false } } })
}, {
    label: 'Integrations',
    to: '/admin/integrations',
    icon: markRaw(IconBrandDocker),
    fetch: () => server.GET('/api/integration', { params: { query: paging } })
}, {
    label: 'Failed User Imports',
    to: '/admin/import?status=Fail',
    icon: markRaw(IconFileImport),
    fetch: () => server.GET('/api/import', { params: { query: { ...paging, impersonate: true, status: 'Fail' } } })
}, {
    label: 'Error Reports',
    to: '/admin/health',
    icon: markRaw(IconBug),
    fetch: () => server.GET('/api/error', { params: { query: paging } })
}]);

const takserverStatus = computed<{ dot: string, label: string, border?: string }>(() => {
    if (takserverError.value) return { dot: 'fail', label: 'Unavailable', border: 'border-danger' };
    if (!takserver.value) return { dot: 'unknown', label: 'Unknown' };

    if (takserver.value.status === 'unconfigured') return { dot: 'fail', label: 'Not Configured', border: 'border-danger' };
    if (!takserver.value.auth) return { dot: 'fail', label: 'No Admin Certificate', border: 'border-danger' };
    if (!takserver.value.connection) return { dot: 'warn', label: 'Paused', border: 'border-warning' };
    if (takserver.value.connection_status === 'live') return { dot: 'success', label: 'Connected', border: 'border-success' };
    if (takserver.value.connection_status === 'dead') return { dot: 'fail', label: 'Disconnected', border: 'border-danger' };

    return { dot: 'unknown', label: 'Unknown' };
});

onMounted(async () => {
    await fetch();
});

async function fetchConfig(keys: string[]): Promise<Record<string, unknown>> {
    const res = await server.GET('/api/config', {
        params: {
            query: {
                keys: keys.join(',')
            }
        }
    });

    if (res.error) throw new Error(res.error.message);

    return res.data;
}

async function fetchServer(): Promise<void> {
    takserverError.value = undefined;

    try {
        const res = await server.GET('/api/server');
        if (res.error) throw new Error(res.error.message);
        takserver.value = res.data;
    } catch (err) {
        takserverError.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function fetchService(service: Service): Promise<void> {
    service.error = undefined;

    try {
        const res = await service.fetch();
        service.configured = res.configured;
        service.detail = res.detail;
    } catch (err) {
        service.configured = undefined;
        service.detail = undefined;
        service.error = err instanceof Error ? err.message : String(err);
    }
}

async function fetchTile(tile: Tile): Promise<void> {
    tile.error = undefined;

    try {
        const res = await tile.fetch();
        if (res.error) throw new Error(res.error.message);
        tile.total = res.data?.total;
    } catch (err) {
        tile.total = undefined;
        tile.error = err instanceof Error ? err.message : String(err);
    }
}

async function fetch(): Promise<void> {
    loading.value = true;

    await Promise.all([
        fetchServer(),
        ...services.value.map(fetchService),
        ...tiles.value.map(fetchTile)
    ]);

    loading.value = false;
}
</script>
