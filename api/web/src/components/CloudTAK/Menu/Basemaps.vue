<template>
    <MenuTemplate name='Basemaps'>
        <template #buttons>
            <TablerIconButton
                title='Create Basemap'
                @click='editModal = {}'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-if='!loading'
                title='Refresh'
                @click='fetchList'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
        </template>

        <template #default>
            <div
                v-if='!share'
                class='col-12 px-2 py-2'
            >
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <TablerLoading v-if='loading' />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <Share
                v-else-if='share'
                style='height: 70vh'
                :basemaps='share'
                @done='share = undefined'
                @cancel='share = undefined'
            />
            <TablerNone
                v-else-if='!list.items.length'
                label='Basemaps'
                @create='editModal = {}'
            />
            <template v-else>
                <MenuItem
                    v-for='collection in list.collections'
                    :key='collection.name'
                    @click='paging.collection = collection.name'
                    @keyup.enter='paging.collection = collection.name'
                >
                    <div class='d-flex align-items-center my-2'>
                        <IconFolder
                            :size='32'
                            stroke='1'
                        />
                        <span
                            class='mx-2 text-truncate'
                            style='font-size: 18px; width: 240px;'
                            v-text='collection.name'
                        />
                    </div>
                </MenuItem>
                <MenuItem
                    v-for='basemap in list.items'
                    :key='basemap.id'
                    @click='setBasemap(basemap)'
                    @keyup.enter='setBasemap(basemap)'
                >
                    <div class='d-flex align-items-center my-2'>
                        <IconMap
                            :size='32'
                            stroke='1'
                        />
                        <span
                            class='mx-2 text-truncate'
                            style='font-size: 18px; width: 240px;'
                            v-text='basemap.name'
                        />

                        <div class='ms-auto d-flex align-items-center'>
                            <span
                                v-if='!basemap.username'
                                class='mx-3 ms-auto badge border bg-blue text-white'
                            >Public</span>
                            <span
                                v-else
                                class='mx-3 ms-auto badge border bg-red text-white'
                            >Private</span>

                            <TablerDropdown>
                                <TablerButton
                                    title='More Options'
                                    style='height: 30px'
                                >
                                    <IconDotsVertical
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerButton>

                                <template #dropdown>
                                    <div clas='col-12'>
                                        <div
                                            v-if='(!basemap.username && profile && profile.system_admin) || basemap.username'
                                            class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2 py-2'
                                            @click.stop.prevent='editModal = basemap'
                                        >
                                            <IconSettings
                                                v-tooltip='"Edit Basemap"'
                                                :size='32'
                                                stroke='1'
                                            />
                                            <span class='mx-2'>Edit Basemap</span>
                                        </div>
                                        <div
                                            class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2 py-2'
                                            @click.stop.prevent='download(basemap)'
                                        >
                                            <IconDownload
                                                :size='32'
                                                stroke='1'
                                            />
                                            <span class='mx-2'>Download XML</span>
                                        </div>
                                        <div
                                            class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2 py-2'
                                            @click.stop.prevent='share = [basemap.id]'
                                        >
                                            <IconShare2
                                                :size='32'
                                                stroke='1'
                                            />
                                            <span class='mx-2'>Share</span>
                                        </div>
                                    </div>
                                </template>
                            </TablerDropdown>
                        </div>
                    </div>
                </MenuItem>

                <div class='col-lg-12'>
                    <TablerPager
                        v-if='list.total > paging.limit'
                        :page='paging.page'
                        :total='list.total'
                        :limit='paging.limit'
                        @page='paging.page = $event'
                    />
                </div>
            </template>
        </template>
    </MenuTemplate>

    <BasemapEditModal
        v-if='editModal'
        size='xl'
        :basemap='editModal'
        @close='editModal = false'
    />
</template>

<script setup lang='ts'>
import { onMounted, ref, computed, watch } from 'vue';
import MenuItem from '../util/MenuItem.vue';
import type { BasemapList, Basemap } from '../../../types.ts';
import { std, stdurl } from '../../../std.ts';
import Overlay from '../../../stores/base/overlay.ts';
import BasemapEditModal from './Basemaps/EditModal.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import Share from '../util/Share.vue';
import {
    TablerNone,
    TablerInput,
    TablerPager,
    TablerAlert,
    TablerButton,
    TablerLoading,
    TablerIconButton,
    TablerDropdown
} from '@tak-ps/vue-tabler';
import {
    IconMap,
    IconPlus,
    IconFolder,
    IconShare2,
    IconRefresh,
    IconSettings,
    IconDownload,
    IconDotsVertical,
} from '@tabler/icons-vue'
import { useMapStore } from '../../../stores/map.ts';
import { useProfileStore } from '../../../stores/profile.ts';
const mapStore = useMapStore();
const profileStore = useProfileStore();

const error = ref<Error | undefined>();
const loading = ref(true);
const editModal = ref();
const share = ref<Array<number> | undefined>();
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

onMounted(async () => {
    await fetchList();
});

const profile = computed(() => profileStore.profile);

watch(editModal, async () => {
    await fetchList();
});

watch(paging.value, async () => {
    await fetchList();
});

async function setBasemap(basemap: Basemap) {
    const hasBasemap = mapStore.overlays.some((overlay) => {
        return overlay.mode === 'basemap';
    });

    if (hasBasemap) {
        for (let i = 0; i < mapStore.overlays.length; i++) {
            const overlay = mapStore.overlays[i];

            if (overlay.mode === 'basemap') {
                if (mapStore.overlays[i + 1]) {
                    await overlay.replace({
                        name: basemap.name,
                        url: `/api/basemap/${basemap.id}/tiles`,
                        mode_id: String(basemap.id)
                    }, {
                        before: mapStore.overlays[i + 1].styles[0].id
                    });
                } else {
                    await overlay.replace({
                        name: basemap.name,
                        url: `/api/basemap/${basemap.id}/tiles`,
                        mode_id: String(basemap.id)
                    });
                }
                break;
            }
        }
    } else {
        const before = String(mapStore.overlays[0].styles[0].id);

        mapStore.overlays.unshift(await Overlay.create(mapStore.map, {
            name: basemap.name,
            pos: -1,
            type: 'raster',
            url: `/api/basemap/${basemap.id}/tiles`,
            mode: 'basemap',
            mode_id: String(basemap.id)
        }, { before }));
    }
}

function download(basemap: Basemap) {
    window.open(stdurl(`api/basemap/${basemap.id}?format=xml&download=true&token=${localStorage.token}`), '_blank');
}

async function fetchList() {
    error.value = undefined;

    try {
        loading.value = true;
        const url = stdurl('/api/basemap');
        if (paging.value.filter) url.searchParams.append('filter', paging.value.filter);
        if (paging.value.collection) url.searchParams.append('collection', String(paging.value.collection));
        url.searchParams.append('limit', String(paging.value.limit));
        url.searchParams.append('page', String(paging.value.page));
        list.value = await std(url) as BasemapList;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
