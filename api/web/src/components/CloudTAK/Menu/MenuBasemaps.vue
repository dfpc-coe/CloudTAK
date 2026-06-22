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
                <SearchSortFilter
                    v-model='paging.filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
                    placeholder='Filter'
                >
                    <template #sort-icon>
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
                </SearchSortFilter>

                <div
                    v-if='paging.collection'
                    class='d-flex align-items-center gap-2'
                >
                    <PathBreadcrumb v-model:collection='paging.collection' />
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
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import { Preferences } from '@capacitor/preferences';
import StandardItemBasemap from '../util/StandardItemBasemap.vue';
import StandardItemFolder from '../util/StandardItemFolder.vue';
import PathBreadcrumb from '../util/PathBreadcrumb.vue';
import type { BasemapList, Basemap } from '../../../types.ts';
import { openExternalUrl } from '../../../base/capacitor.ts';
import ProfileConfig from '../../../base/profile.ts';
import { server, stdurl } from '../../../std.ts';
import OverlayManager from '../../../base/overlay.ts';
import type { Subscription } from 'dexie';
import BasemapEditModal from './Basemaps/EditModal.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import SearchSortFilter from '../util/SearchSortFilter.vue';
import Share from '../util/Share.vue';
import {
    TablerNone,
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
    IconLetterCase,
    IconArrowUp,
    IconArrowDown,
} from '@tabler/icons-vue'
import type { LayerSpecification } from 'maplibre-gl'
import { useRouter } from 'vue-router';

const overlayBasemapIds = ref<Set<string>>(new Set());
const currentBasemapModeIds = ref<Set<string>>(new Set());
let overlaySubscription: Subscription | undefined;

onMounted(() => {
    overlaySubscription = OverlayManager.liveList().subscribe({
        next: (items) => {
            overlayBasemapIds.value = new Set(
                items
                    .filter((overlay) => overlay.mode === 'overlay' && overlay.mode_id)
                    .map((overlay) => String(overlay.mode_id))
            );
            currentBasemapModeIds.value = new Set(
                items
                    .filter((overlay) => overlay.mode === 'basemap' && overlay.mode_id)
                    .map((overlay) => String(overlay.mode_id))
            );
        }
    });
});

onUnmounted(() => {
    overlaySubscription?.unsubscribe();
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

const sort = ref('A → Z');
const sortOptions = ['A → Z', 'Z → A'];
const sortTypeIcon = computed(() => IconLetterCase);
const sortDirectionIcon = computed(() => sort.value === 'A → Z' ? IconArrowUp : IconArrowDown);

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

watch(sort, async () => {
    await fetchList();
});

async function setBasemap(basemap: Basemap) {
    const overlays = OverlayManager.loaded;
    const hasBasemap = overlays.some((overlay) => {
        return overlay.mode === 'basemap';
    });

    if (hasBasemap) {
        for (let i = 0; i < overlays.length; i++) {
            const overlay = overlays[i];

            if (overlay.mode === 'basemap') {
                if (overlays[i + 1]) {
                    await overlay.replace({
                        name: basemap.name,
                        type: basemap.type,
                        opacity: 1,
                        visible: true,
                        url: `/api/basemap/${basemap.id}/tiles`,
                        mode: 'basemap',
                        mode_id: String(basemap.id),
                        styles: basemap.styles as Array<LayerSpecification>
                    }, {
                        before: overlays[i + 1].styles[0].id
                    });
                } else {
                    await overlay.replace({
                        name: basemap.name,
                        type: basemap.type,
                        opacity: 1,
                        visible: true,
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
        const before = String(overlays[0].styles[0].id);

        await OverlayManager.createLoaded({
            name: basemap.name,
            pos: -1,
            type: basemap.type,
            opacity: 1,
            visible: true,
            frequency: basemap.frequency,
            url: `/api/basemap/${basemap.id}/tiles`,
            mode: 'basemap',
            mode_id: String(basemap.id),
            styles: basemap.styles
        }, { before, position: 'prepend' });
    }
}

async function download(basemap: Basemap) {
    const { value: token } = await Preferences.get({ key: 'token' });
    void openExternalUrl(stdurl(`/api/basemap/${basemap.id}?format=xml&download=true${token ? `&token=${encodeURIComponent(token)}` : ''}`));
}

function setCollection(name: string) {
    paging.value.collection = name;
    paging.value.filter = '';
}

function isCurrentBasemap(basemapId: number): boolean {
    return currentBasemapModeIds.value.has(String(basemapId));
}

async function addOverlay(basemap: Basemap) {
    try {
        await OverlayManager.createLoaded({
            url: String(stdurl(`/api/basemap/${basemap.id}/tiles`)),
            name: basemap.name,
            mode: 'overlay',
            mode_id: String(basemap.id),
            frequency: basemap.frequency,
            type: basemap.type,
            styles: basemap.styles
        });

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
                    order: sort.value === 'A → Z' ? 'asc' : 'desc',
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
