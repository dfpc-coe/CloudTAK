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
            <TablerRefreshButton
                :loading='loading'
                @click='fetchList'
            />
        </template>

        <template #default>
            <div
                v-if='!share'
                class='col-12 px-2 py-2 d-flex align-items-center'
            >
                <TablerIconButton
                    v-if='paging.collection'
                    title='Back'
                    @click='paging.collection = ""'
                >
                    <IconCircleArrowLeft
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>
                <TablerInput
                    v-model='paging.filter'
                    :style='paging.collection ? "width: calc(100% - 32px);" : "width: 100%;"'
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
                @close='share = undefined'
            />
            <TablerNone
                v-else-if='!list.items.length && !list.collections.length'
                label='Basemaps'
                @create='editModal = {}'
            />
            <template v-else>
                <MenuItem
                    v-for='collection in list.collections'
                    :key='collection.name'
                    @click='setCollection(collection.name)'
                    @keyup.enter='setCollection(collection.name)'
                >
                    <div class='d-flex align-items-center my-2'>
                        <IconFolder
                            :size='32'
                            stroke='1'
                        />
                        <span
                            class='mx-2 text-truncate user-select-none'
                            style='font-size: 18px; width: 240px;'
                            v-text='collection.name'
                        />
                    </div>
                </MenuItem>
                <MenuItem
                    v-for='basemap in list.items'
                    :key='basemap.id'
                    :class='{ "bg-blue text-white": isCurrentBasemap(basemap.id) }'
                    @click='setBasemap(basemap)'
                    @keyup.enter='setBasemap(basemap)'
                >
                    <div class='d-flex align-items-center my-2'>
                        <IconMap
                            :size='32'
                            stroke='1'
                        />
                        <span
                            class='mx-2 text-truncate user-select-none'
                            style='font-size: 18px; width: 220px;'
                            v-text='basemap.name'
                        />

                        <div class='ms-auto d-flex align-items-center'>
                            <span
                                v-if='!basemap.username'
                                class='mx-3 ms-auto badge border'
                                :class='isCurrentBasemap(basemap.id) ? "bg-white text-blue" : "bg-blue text-white"'
                            >Public</span>
                            <span
                                v-else
                                class='mx-3 ms-auto badge border bg-red text-white'
                            >Private</span>

                            <TablerDropdown>
                                <TablerIconButton
                                    title='More Options'
                                >
                                    <IconDotsVertical
                                        :size='20'
                                        stroke='1'
                                    />
                                </TablerIconButton>

                                <template #dropdown>
                                    <div clas='col-12'>
                                        <div
                                            v-if='(!basemap.username && isSystemAdmin) || basemap.username'
                                            class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
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
                                            class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
                                            @click.stop.prevent='download(basemap)'
                                        >
                                            <IconDownload
                                                :size='32'
                                                stroke='1'
                                            />
                                            <span class='mx-2'>Download XML</span>
                                        </div>
                                        <div
                                            class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
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

                <div class='col-lg-12 d-flex'>
                    <div class='ms-auto'>
                        <TablerPager
                            v-if='list.total > paging.limit'
                            :page='paging.page'
                            :total='list.total'
                            :limit='paging.limit'
                            @page='paging.page = $event'
                        />
                    </div>
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
import { onMounted, ref, watch } from 'vue';
import MenuItem from '../util/MenuItem.vue';
import type { BasemapList, Basemap } from '../../../types.ts';
import { server, stdurl } from '../../../std.ts';
import Overlay from '../../../base/overlay.ts';
import BasemapEditModal from './Basemaps/EditModal.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import Share from '../util/Share.vue';
import {
    TablerNone,
    TablerInput,
    TablerPager,
    TablerAlert,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
    TablerDropdown
} from '@tak-ps/vue-tabler';
import {
    IconMap,
    IconPlus,
    IconFolder,
    IconShare2,
    IconSettings,
    IconDownload,
    IconDotsVertical,
    IconCircleArrowLeft,
} from '@tabler/icons-vue'
import type { LayerSpecification } from 'maplibre-gl'
import { useMapStore } from '../../../stores/map.ts';
const mapStore = useMapStore();

const isSystemAdmin = ref<boolean>(false);

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
    isSystemAdmin.value = await mapStore.worker.profile.isSystemAdmin();
});

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
                        type: basemap.type,
                        url: `/api/basemap/${basemap.id}/tiles`,
                        mode: 'basemap',
                        mode_id: String(basemap.id),
                        styles: basemap.styles as Array<LayerSpecification>
                    }, {
                        before: mapStore.overlays[i + 1].styles[0].id
                    });
                } else {
                    await overlay.replace({
                        name: basemap.name,
                        type: basemap.type,
                        url: `/api/basemap/${basemap.id}/tiles`,
                        mode: 'basemap',
                        mode_id: String(basemap.id),
                        styles: basemap.styles as Array<LayerSpecification>
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
            type: basemap.type,
            url: `/api/basemap/${basemap.id}/tiles`,
            mode: 'basemap',
            mode_id: String(basemap.id),
            styles: basemap.styles
        }, { before }));
    }
}

function download(basemap: Basemap) {
    window.open(stdurl(`/api/basemap/${basemap.id}?format=xml&download=true&token=${localStorage.token}`), '_blank');
}

function setCollection(name: string) {
    paging.value.collection = name;
    paging.value.filter = '';
}

function isCurrentBasemap(basemapId: number): boolean {
    const currentBasemap = mapStore.overlays.find(overlay => 
        overlay.mode === 'basemap' && overlay.mode_id === String(basemapId)
    );
    return !!currentBasemap;
}

async function fetchList() {
    error.value = undefined;

    try {
        loading.value = true;

        const res = await server.GET('/api/basemap', {
            params: {
                query: {
                    overlay: false,
                    filter: paging.value.filter,
                    collection: paging.value.collection ? paging.value.collection : undefined,
                    limit: paging.value.limit,
                    order: 'asc',
                    sort: 'name',
                    page: paging.value.page,
                    type: ['vector', 'raster']
                }
            }
        })

        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }

    loading.value = false;
}
</script>
