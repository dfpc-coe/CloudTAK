<template>
    <MenuTemplate name='Overlay Explorer'>
        <template #buttons>
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>
        <template #default>
            <div class='d-flex flex-column gap-3 min-vh-100'>
                <div class='mt-2 d-flex align-items-center gap-3 flex-wrap'>
                    <TablerInput
                        v-model='paging.filter'
                        icon='search'
                        placeholder='Search overlays...'
                        class='flex-grow-1'
                    />
                </div>

                <div
                    v-if='paging.collection'
                    class='d-flex align-items-center gap-2'
                >
                    <BasemapCollection v-model:collection='paging.collection' />
                </div>

                <TablerLoading v-if='loading' />
                <template v-else>
                    <StandardItem
                        class='p-3 bg-info-subtle border border-info border-opacity-50'
                        @click='goToFiles'
                    >
                        <div class='d-flex justify-content-between gap-3 w-100'>
                            <div class='d-flex align-items-center gap-2 flex-grow-1 min-w-0'>
                                <IconUser
                                    class='flex-shrink-0 text-white-50'
                                    :size='24'
                                    stroke='1'
                                />
                                <div class='flex-grow-1 min-w-0'>
                                    <div class='d-flex align-items-center gap-2'>
                                        <span class='fw-semibold'>Your Files</span>
                                    </div>
                                    <p class='mb-0 small text-white-50'>
                                        Access overlays you have uploaded
                                    </p>
                                </div>
                            </div>
                            <div class='d-flex align-items-center gap-2 flex-wrap'>
                                <TablerIconButton
                                    title='Open Files'
                                    @click.stop.prevent='goToFiles'
                                >
                                    <IconFolder
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>
                            </div>
                        </div>
                    </StandardItem>

                    <div
                        v-if='list.items.length || list.collections.length'
                        class='d-flex flex-column gap-2'
                    >
                        <StandardItemFolder
                            v-for='collection in list.collections'
                            :key='collection.name'
                            :name='collection.name'
                            @click='setCollection(collection.name)'
                        />

                        <StandardItemBasemap
                            v-for='basemap in list.items'
                            :key='basemap.id'
                            :basemap='basemap'
                            :class='[
                                basemapExists(basemap) || loading ? "opacity-50 pe-none" : "",
                            ]'
                            :hover='!basemapExists(basemap) && !loading'
                            :aria-disabled='loading || basemapExists(basemap)'
                            @click='handleExplorerSelect(basemap)'
                        />
                    </div>

                    <TablerNone
                        v-else
                        label='No Overlays'
                        :create='false'
                    />
                </template>
            </div>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import type { Basemap, BasemapList } from '../../../types.ts';
import { server, stdurl } from '../../../std.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerRefreshButton,
    TablerIconButton
} from '@tak-ps/vue-tabler';
import {
    IconUser,
    IconFolder
} from '@tabler/icons-vue';
import StandardItem from '../util/StandardItem.vue';
import StandardItemBasemap from '../util/StandardItemBasemap.vue';
import StandardItemFolder from '../util/StandardItemFolder.vue';
import BasemapCollection from '../util/BasemapCollection.vue';
import Overlay from '../../../base/overlay.ts';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();
const router = useRouter();

const loading = ref(false);

const paging = ref({
    filter: '',
    collection: '',
    limit: 30,
    page: 0
});

const list = ref<BasemapList>({
    total: 0,
    collections: [],
    items: []
});

const overlayBasemapIds = computed<Set<string>>(() => {
    const ids = new Set<string>();

    for (const overlay of mapStore.overlays as Array<{ mode?: string; mode_id?: string | number | null }>) {
        if (overlay.mode === 'overlay' && overlay.mode_id) {
            ids.add(String(overlay.mode_id));
        }
    }

    return ids;
});

watch(
    () => [paging.value.filter, paging.value.collection, paging.value.limit, paging.value.page],
    async () => {
        await fetchList();
    }
);

onMounted(async () => {
    await fetchList();
});

function basemapExists(basemap: Basemap): boolean {
    return overlayBasemapIds.value.has(String(basemap.id));
}

async function handleExplorerSelect(basemap: Basemap) {
    if (loading.value) return;
    if (basemapExists(basemap)) return;
    await createOverlay(basemap);
}

function goToFiles() {
    router.push('/menu/files');
}

function setCollection(name: string): void {
    paging.value.collection = name;
    paging.value.filter = '';
    paging.value.page = 0;
}

async function createOverlay(overlay: Basemap) {
    loading.value = true;

    try {
        const createdOverlay = await Overlay.create({
            url: String(stdurl(`/api/basemap/${overlay.id}/tiles`)),
            name: overlay.name,
            mode: 'overlay',
            mode_id: String(overlay.id),
            frequency: overlay.frequency,
            type: overlay.type,
            styles: overlay.styles
        }, {
            before: mapStore.getOverlayBeforeId()
        });

        mapStore.addOverlay(createdOverlay);

        router.push('/menu/overlays');
    } finally {
        loading.value = false;
    }
}

async function fetchList(): Promise<void> {
    loading.value = true;

    try {
        const { data, error } = await server.GET('/api/basemap', {
            params: {
                query: {
                    filter: paging.value.filter,
                    collection: paging.value.collection || undefined,
                    overlay: true,
                    limit: paging.value.limit,
                    page: paging.value.page,
                    order: 'asc',
                    sort: 'name',
                    hidden: 'false'
                }
            }
        });

        if (error) throw new Error(error.message);
        if (!data) throw new Error('No data returned');

        list.value = data;
    } finally {
        loading.value = false;
    }
}
</script>
