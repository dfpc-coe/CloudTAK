<template>
    <MenuTemplate
        name='Deleted Features'
        :loading='!mapStore.isLoaded'
    >
        <template #buttons>
            <TablerDropdown>
                <TablerIconButton
                    title='Export'
                >
                    <IconDownload
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <template #dropdown>
                    <div
                        class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                        @click.stop.prevent='download("geojson")'
                    >
                        <IconFile
                            :size='32'
                            stroke='1'
                        />
                        <span class='mx-2'>GeoJSON</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                        @click.stop.prevent='download("kml")'
                    >
                        <IconFile
                            :size='32'
                            stroke='1'
                        />
                        <span class='mx-2'>KML</span>
                    </div>
                </template>
            </TablerDropdown>

            <TablerRefreshButton
                :loading='loading'
                @click='refresh'
            />
        </template>
        <template #default>
            <div class='my-2'>
                <SearchSortFilter
                    v-model='query.filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
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
                </SearchSortFilter>
            </div>
            <TablerLoading
                v-if='loading'
                v-model='query.filter'
                desc='Loading Deleted Features'
            />
            <TablerNone
                v-else-if='list.features.length === 0'
                :create='false'
                label='No Archived Features'
            />
            <template v-else>
                <GenericSelect
                    ref='select'
                    role='menu'
                    :disabled='false'
                    :hover='false'
                    :sticky-controls='true'
                    :items='list.features'
                >
                    <template #buttons='{disabled}'>
                        <TablerIconButton
                            title='Restore Features'
                            :disabled='disabled'
                            @click.stop='restoreFeatures'
                        >
                            <IconRestore
                                :size='32'
                                stroke='1'
                            />
                        </TablerIconButton>
                    </template>
                    <template #item='{ item }'>
                        <FeatureRow
                            :id='item.id'
                            :select='false'
                            :grip-handle='false'
                            :delete-button='false'
                            :info-button='false'
                            :feature='item'
                        />
                    </template>
                </GenericSelect>
                <div class='d-flex justify-content-center mt-2'>
                    <TablerPager
                        :page='query.page'
                        :total='total'
                        :limit='query.limit'
                        @page='query.page = $event'
                    />
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, onBeforeUnmount, watch, computed, useTemplateRef } from 'vue';
import { Preferences } from '@capacitor/preferences';
import MenuTemplate from '../util/MenuTemplate.vue';
import SearchSortFilter from '../util/SearchSortFilter.vue';
import FeatureRow from '../util/FeatureRow.vue';
import GenericSelect from '../util/GenericSelect.vue';
import {
    TablerNone,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
    TablerRefreshButton,
    TablerPager,
} from '@tak-ps/vue-tabler';
import { std, server } from '../../../std.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import type { WorkerMessage } from '../../../base/events.ts';
import type { ComponentExposed } from 'vue-component-type-helpers'
import type { FeatureCollection } from '../../../types.ts';
import {
    IconFile,
    IconRestore,
    IconDownload,
    IconLetterCase,
    IconClock,
    IconArrowUp,
    IconArrowDown,
    IconArrowsSort,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

const list = ref<FeatureCollection>({
    type: 'FeatureCollection',
    features: []
});

const total = ref(0);

const query = ref({
    filter: '',
    page: 0,
    deleted: true,
    download: false,
    limit: 25
})

const loading = ref(true);
const select = useTemplateRef<ComponentExposed<typeof GenericSelect>>('select');

const sort = ref('');
const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'A → Z', 'Z → A'];
const sortTypeIcon = computed(() => (sort.value === 'A → Z' || sort.value === 'Z → A') ? IconLetterCase : IconClock);
const sortDirectionIcon = computed(() => (sort.value === 'Newest → Oldest' || sort.value === 'Z → A') ? IconArrowDown : IconArrowUp);

let filterTimer: ReturnType<typeof setTimeout> | null = null;
watch(() => query.value.filter, () => {
    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = setTimeout(async () => {
        query.value.page = 0;
        await refresh();
    }, 300);
});

watch(() => query.value.page, async () => {
    await refresh();
});

watch(sort, async () => {
    query.value.page = 0;
    await refresh();
});

onMounted(async () => {
    channel.onmessage = async (event: MessageEvent<WorkerMessage>) => {
        const msg = event.data;
        if (msg?.type === WorkerMessageType.Feature_Archived_Removed) {
            await refresh();
        }
    };

    await refresh();
});

onBeforeUnmount(() => {
    channel.close();
});

const channel = new BroadcastChannel('cloudtak');

async function refresh() {
    loading.value = true;

    try {
        const res = await server.GET('/api/profile/feature', {
            params: {
                query: {
                    sort: (sort.value === 'A → Z' || sort.value === 'Z → A') ? 'path' : 'id',
                    order: (sort.value === 'Newest → Oldest' || sort.value === 'Z → A') ? 'asc' : 'desc',
                    page: query.value.page,
                    download: query.value.download,
                    deleted: query.value.deleted,
                    filter: query.value.filter || undefined,
                    format: 'geojson',
                    limit: query.value.limit
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        total.value = res.data.total;
        list.value.features = res.data.items.map((feat) => {
            return {
                id: feat.id,
                type: feat.type,
                path: feat.path,
                properties: {
                    id: feat.id,
                    ...feat.properties
                },
                geometry: feat.geometry
            }
        });

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function restoreFeatures(): Promise<void> {
    if (!select.value) return;
    const selected = select.value.selected;

    loading.value = true;

    for (const feature of list.value.features) {
        if (selected.has(feature.id)) {
            await mapStore.worker.db.add(JSON.parse(JSON.stringify(feature)), {
                authored: true
            });
        }
    }

    // TODO: Improve this to not be a timeout, the API operations can occasionally return the feature
    setTimeout(async () => {
        await refresh();
    }, 500);
}

async function download(format: string): Promise<void> {
    const { value: token } = await Preferences.get({ key: 'token' });
    await std(`/api/profile/feature?format=${format}&download=true&deleted=true${token ? `&token=${encodeURIComponent(token)}` : ''}`, {
        download: true
    });
}
</script>
