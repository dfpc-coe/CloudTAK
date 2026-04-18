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
                class='col-12 py-2 d-flex flex-column gap-2'
            >
                <TablerInput
                    v-model='paging.filter'
                    class='w-100'
                    icon='search'
                    placeholder='Filter'
                />

                <div
                    v-if='paging.collection'
                    class='d-flex align-items-center gap-2'
                >
                    <BasemapCollection v-model:collection='paging.collection' />
                </div>
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
                label='No Basemaps'
                @create='editModal = {}'
            />
            <template v-else>
                <div class='col-12 d-flex flex-column gap-2 py-3'>
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
                        :class='{ "bg-blue text-white": isCurrentBasemap(basemap.id) }'
                        @click='setBasemap(basemap)'
                    >
                        <template #actions>
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
                                    <div class='col-12'>
                                        <div
                                            v-if='(!basemap.username && isSystemAdmin) || basemap.username'
                                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
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
                                            :class='[
                                                "col-12 d-flex align-items-center px-2 py-2",
                                                basemapOverlayExists(basemap) ? "opacity-50 pe-none" : "cursor-pointer cloudtak-hover"
                                            ]'
                                            :aria-disabled='basemapOverlayExists(basemap)'
                                            @click.stop.prevent='!basemapOverlayExists(basemap) && addOverlay(basemap)'
                                        >
                                            <IconBoxMultiple
                                                v-tooltip='basemapOverlayExists(basemap) ? "Overlay already added" : "Add Overlay"'
                                                :size='32'
                                                stroke='1'
                                            />
                                            <span class='mx-2'>{{ basemapOverlayExists(basemap) ? "Overlay already added" : "Add as Overlay" }}</span>
                                        </div>
                                        <div
                                            v-if='basemap.sharing_enabled'
                                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                                            @click.stop.prevent='download(basemap)'
                                        >
                                            <IconDownload
                                                :size='32'
                                                stroke='1'
                                            />
                                            <span class='mx-2'>Download XML</span>
                                        </div>
                                        <div
                                            v-if='basemap.sharing_enabled'
                                            class='cursor-pointer col-12 cloudtak-hover d-flex align-items-center px-2 py-2'
                                            @click.stop.prevent='basemap.sharing_enabled ? share = [basemap.id] : null'
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
                        </template>
                    </StandardItemBasemap>
                </div>

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
import { onMounted, ref, watch, computed } from 'vue';
import StandardItemBasemap from '../util/StandardItemBasemap.vue';
import StandardItemFolder from '../util/StandardItemFolder.vue';
import BasemapCollection from '../util/BasemapCollection.vue';
import type { BasemapList, Basemap } from '../../../types.ts';
import ProfileConfig from '../../../base/profile.ts';
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
    IconPlus,
    IconShare2,
    IconDownload,
    IconSettings,
    IconBoxMultiple,
    IconDotsVertical,
} from '@tabler/icons-vue'
import type { LayerSpecification } from 'maplibre-gl'
import { useRouter } from 'vue-router';
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

const overlayBasemapIds = computed<Set<string>>(() => {
    return new Set(
        mapStore.overlays
            .filter((overlay) => overlay.mode === 'overlay' && overlay.mode_id)
            .map((overlay) => String(overlay.mode_id))
    );
});

function basemapOverlayExists(basemap: Basemap): boolean {
    return overlayBasemapIds.value.has(String(basemap.id));
}

const router = useRouter();
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
    const isSysAdmin = await ProfileConfig.get('system_admin');
    isSystemAdmin.value = isSysAdmin?.value ?? false;
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

        mapStore.overlays.unshift(await Overlay.create({
            name: basemap.name,
            pos: -1,
            type: basemap.type,
            frequency: basemap.frequency,
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

async function addOverlay(basemap: Basemap) {
    try {
        // Insert in 1st position after basemap where mapStore.overlays[0] is the basemap
        mapStore.addOverlay(await Overlay.create({
            url: String(stdurl(`/api/basemap/${basemap.id}/tiles`)),
            name: basemap.name,
            mode: 'overlay',
            mode_id: String(basemap.id),
            frequency: basemap.frequency,
            type: basemap.type,
            styles: basemap.styles
        }, {
            before: mapStore.getOverlayBeforeId()
        }));

        loading.value = false;

        router.push('/menu/overlays');
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function fetchList() {
    error.value = undefined;

    try {
        loading.value = true;

        const res = await server.GET('/api/basemap', {
            params: {
                query: {
                    hidden: 'false',
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

<style scoped>
.text-decoration-underline-hover:hover {
    text-decoration: underline;
}
</style>
