<template>
    <MenuTemplate
        name='Devices'
        :loading='loading'
    >
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div class='px-2 pt-2'>
                <SearchSortFilter
                    v-model='paging.filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
                    placeholder='Search Devices'
                />
            </div>

            <div
                v-if='source === "local"'
                class='px-2 pt-2'
            >
                <TablerInlineAlert
                    severity='warning'
                    title='Showing Cached Devices'
                    :description='`${localReason} Only Devices that have been received on the map are listed.`'
                />
            </div>

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!rows.length && !loading'
                label='No Devices'
                :create='false'
            />
            <div
                v-else
                class='col-12 d-flex flex-column gap-2 px-2 py-3'
            >
                <StandardCoreDevice
                    v-for='row in rows'
                    :key='row.id'
                    :device='row'
                    @click='open(row)'
                />
            </div>

            <div
                v-if='source === "api" && total > paging.limit'
                class='px-2 pb-3 d-flex'
            >
                <div class='ms-auto'>
                    <TablerPager
                        :page='paging.page'
                        :total='total'
                        :limit='paging.limit'
                        @page='paging.page = $event'
                    />
                </div>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import {
    TablerNone,
    TablerAlert,
    TablerPager,
    TablerInlineAlert,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../util/MenuTemplate.vue';
import SearchSortFilter from '../util/SearchSortFilter.vue';
import StandardCoreDevice from '../util/StandardCoreDevice.vue';
import type { DeviceRow } from '../util/StandardCoreDevice.vue';
import type COT from '../../../base/cot.ts';
import type { CoreDevice, CoreDeviceList } from '../../../types.ts';
import { server } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import { useDeviceStore } from '../../../stores/device.ts';

type CoreDeviceSort = 'created' | 'updated' | 'name';

const router = useRouter();
const mapStore = useMapStore();
const deviceStore = useDeviceStore();

const loading = ref(true);
const error = ref<Error | undefined>();

// Devices come from the API when it can be reached, otherwise from the Device
// CoTs the map has already received so the list keeps working offline
const source = ref<'api' | 'local'>('api');
const localReason = ref('');

const paging = ref({
    filter: '',
    limit: 20,
    page: 0,
    sort: 'created' as CoreDeviceSort,
    order: 'desc' as 'asc' | 'desc',
});

const sort = ref('');
const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'A → Z', 'Z → A'];

const total = ref(0);
const apiRows = ref<Array<DeviceRow>>([]);
const localRows = ref<Array<DeviceRow>>([]);

const rows = computed(() => {
    if (source.value === 'api') return apiRows.value;

    const filter = paging.value.filter.toLowerCase();
    const dir = paging.value.order === 'asc' ? 1 : -1;

    return localRows.value
        .filter((row) => row.name.toLowerCase().includes(filter))
        .sort((a, b) => {
            if (paging.value.sort === 'name') return a.name.localeCompare(b.name) * dir;
            return (a.updated.localeCompare(b.updated)) * dir;
        });
});

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
    if (source.value === 'api') await fetchList();
});

onMounted(async () => {
    window.addEventListener('online', fetchList);
    await fetchList();
});

onBeforeUnmount(() => {
    window.removeEventListener('online', fetchList);
});

async function fetchList(): Promise<void> {
    loading.value = true;
    error.value = undefined;

    if (!deviceStore.network.isOnline) {
        await fetchLocal('This device is offline.');
        loading.value = false;
        return;
    }

    try {
        const res = await server.GET('/api/core/device', {
            params: {
                query: {
                    filter: paging.value.filter,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: paging.value.sort,
                    order: paging.value.order,
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        const list = res.data as CoreDeviceList;
        const located = await locatedIds(list.items.map((device) => device.id));

        total.value = list.total;
        apiRows.value = list.items.map((device) => fromDevice(device, located));
        source.value = 'api';
    } catch (err) {
        console.error('Failed to list Core Devices', err);
        await fetchLocal('The Device API could not be reached.');
    }

    loading.value = false;
}

async function fetchLocal(reason: string): Promise<void> {
    try {
        const cots = await mapStore.worker.db.filter('$exists(properties.links[type="core-device"])');

        localRows.value = Array.from(cots).map(fromCot);
        localReason.value = reason;
        source.value = 'local';
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function locatedIds(ids: Array<string>): Promise<Set<string>> {
    const located = new Set<string>();

    for (const id of ids) {
        if (await mapStore.worker.db.has(id)) located.add(id);
    }

    return located;
}

function fromDevice(device: CoreDevice, located: Set<string>): DeviceRow {
    const hardware = [device.manufacturer, device.model].filter(Boolean).join(' ');

    return {
        id: device.id,
        name: device.name,
        type: device.type,
        updated: device.updated,
        located: !!device.geometry && located.has(device.id),
        stale: false,
        simulated: device.simulated,
        status: device.status || undefined,
        battery: device.battery ?? undefined,
        hardware: hardware || undefined,
        source: 'api',
        icon: {
            properties: {
                type: device.type,
                icon: device.style.icon,
                'marker-color': device.style['marker-color'],
            }
        },
    };
}

function fromCot(cot: COT): DeviceRow {
    return {
        id: cot.id,
        name: cot.properties.callsign || 'Unnamed',
        type: cot.properties.type,
        updated: cot.properties.time,
        located: true,
        stale: +new Date(cot.properties.stale) < Date.now(),
        simulated: false,
        source: 'local',
        icon: {
            properties: cot.properties as Record<string, unknown>,
        },
    };
}

// An API row goes straight to the Device View - a cached row goes through
// the CoT View, which redirects to the Device View once the API is reachable
function open(row: DeviceRow): void {
    router.push(row.source === 'api' ? `/device/${row.id}` : `/cot/${row.id}`);
}
</script>
