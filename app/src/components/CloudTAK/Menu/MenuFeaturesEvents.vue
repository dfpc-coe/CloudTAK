<template>
    <MenuTemplate
        name='Features'
    >
        <template #buttons>
            <TablerIconButton
                title='Create Event'
                @click='openCreateEvent'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <FeaturesTabs />

            <div class='px-2 pt-2'>
                <SearchSortFilter
                    v-model='paging.filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
                    :active-filters='paging.channel === undefined ? 0 : 1'
                    placeholder='Search Events'
                >
                    <template #filters>
                        <div class='d-flex flex-column'>
                            <div class='d-flex align-items-center justify-content-between px-3 py-2'>
                                <strong class='small text-uppercase text-white-50'>Filters</strong>
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
                                    <div class='small text-uppercase text-white-50 mb-1'>
                                        Channels
                                    </div>
                                    <div
                                        v-if='!channels.length'
                                        class='small text-white-50'
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

            <div
                v-if='source === "local"'
                class='px-2 pt-2'
            >
                <TablerInlineAlert
                    severity='warning'
                    title='Showing Cached Events'
                    :description='`${localReason} Only Events that have been received on the map are listed.`'
                />
            </div>

            <TablerAlert
                v-if='error'
                :err='error'
            />
            <TablerLoading
                v-else-if='loading'
                desc='Loading Events'
            />
            <TablerNone
                v-else-if='source === "api" ? !events.length : !localCots.length'
                label='No Events'
                :create='false'
            />
            <div
                v-else-if='source === "api"'
                class='col-12 d-flex flex-column gap-2 px-2 py-3'
            >
                <StandardCoreEntity
                    v-for='event in events'
                    :key='event.id'
                    :event='event'
                    @click='router.push(`/event/${event.id}`)'
                />
            </div>
            <div
                v-else
                class='col-12 py-3'
            >
                <Feature
                    v-for='cot of localCots'
                    :id='cot.id'
                    :key='cot.id'
                    :delete-button='false'
                    :info-button='true'
                    :feature='cot'
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
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import {
    TablerNone,
    TablerAlert,
    TablerPager,
    TablerLoading,
    TablerIconButton,
    TablerInlineAlert,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import { IconPlus } from '@tabler/icons-vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import FeaturesTabs from './Features/FeaturesTabs.vue';
import SearchSortFilter from '../util/SearchSortFilter.vue';
import StandardCoreEntity from '../util/StandardCoreEntity.vue';
import CreateCoreEntity from '../util/CreateCoreEntity.vue';
import Feature from '../util/FeatureRow.vue';
import type COT from '../../../base/cot.ts';
import type { CoreEntity, CoreEntityList } from '../../../types.ts';
import { server } from '../../../std.ts';
import { useMapStore } from '../../../stores/map.ts';
import { useFloatStore } from '../../../stores/float.ts';
import { useDeviceStore } from '../../../stores/device.ts';

type CoreEntitySort = 'created' | 'updated' | 'name';

const router = useRouter();
const mapStore = useMapStore();
const floatStore = useFloatStore();
const deviceStore = useDeviceStore();

const loading = ref(true);
const error = ref<Error | undefined>();

// Events come from the API when it can be reached, otherwise from the Event
// CoTs the map has already received so the list keeps working offline
const source = ref<'api' | 'local'>('api');
const localReason = ref('');

const paging = ref({
    filter: '',
    channel: undefined as number | undefined,
    limit: 20,
    page: 0,
    sort: 'created' as CoreEntitySort,
    order: 'desc' as 'asc' | 'desc',
});

const sort = ref('');
const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'A → Z', 'Z → A'];

const total = ref(0);
const events = ref<Array<CoreEntity>>([]);
const localCots = ref<Array<COT>>([]);
const channels = ref<Array<{ name: string, bitpos: number }>>([]);

// Bumped per load so a late response is dropped, not adopted
let fetchSeq = 0;

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
    window.addEventListener('online', fetchList);
    await Promise.all([
        fetchList(),
        fetchChannels(),
    ]);
});

onBeforeUnmount(() => {
    fetchSeq++;
    window.removeEventListener('online', fetchList);
});

function toggleChannel(bitpos: number): void {
    paging.value.channel = paging.value.channel === bitpos ? undefined : bitpos;
}

function openCreateEvent(): void {
    const uid = 'create-event';
    if (floatStore.panes.has(uid)) return;

    floatStore.add({
        uid,
        name: 'Create Event',
        component: CreateCoreEntity,
        height: 640,
        width: 600,
        corner: 'top-right',
    });
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
        console.error('Failed to list Channels', err);
    }
}

async function fetchList(): Promise<void> {
    const current = ++fetchSeq;

    loading.value = true;
    error.value = undefined;

    if (!deviceStore.network.isOnline) {
        await fetchLocal('This device is offline.');
        if (current === fetchSeq) loading.value = false;
        return;
    }

    try {
        const res = await server.GET('/api/core/event', {
            params: {
                query: {
                    filter: paging.value.filter,
                    channel: paging.value.channel,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    sort: paging.value.sort,
                    order: paging.value.order,
                }
            }
        });

        if (current !== fetchSeq) return;
        if (res.error) throw new Error(res.error.message);

        const list = res.data as CoreEntityList;
        total.value = list.total;
        events.value = list.items;
        source.value = 'api';
    } catch (err) {
        if (current !== fetchSeq) return;
        console.error('Failed to list Core Events', err);
        await fetchLocal('The Event API could not be reached.');
    }

    if (current === fetchSeq) loading.value = false;
}

async function fetchLocal(reason: string): Promise<void> {
    try {
        const filter = paging.value.filter.toLowerCase();
        const cots = await mapStore.worker.db.filter('$exists(properties.links[type="core-event"])');

        localCots.value = Array.from(cots)
            .filter((cot) => (cot.properties.callsign ?? '').toLowerCase().includes(filter))
            .sort((a, b) => {
                const dir = paging.value.order === 'asc' ? 1 : -1;
                if (paging.value.sort === 'name') {
                    return (a.properties.callsign ?? '').localeCompare(b.properties.callsign ?? '') * dir;
                }
                return (a.properties.time ?? '').localeCompare(b.properties.time ?? '') * dir;
            });
        localReason.value = reason;
        source.value = 'local';
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}
</script>

<style scoped>
:deep(.form-check-input) {
    background-color: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.5);
}

:deep(.form-check-input:checked) {
    background-color: var(--tblr-primary);
    border-color: var(--tblr-primary);
}

[data-bs-theme='light'] :deep(.form-check-input) {
    background-color: #fff;
    border-color: rgba(0, 0, 0, 0.25);
}

[data-bs-theme='light'] :deep(.form-check-input:checked) {
    background-color: var(--tblr-primary);
    border-color: var(--tblr-primary);
}
</style>
