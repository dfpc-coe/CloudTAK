<template>
    <MenuTemplate
        name='Saved Features'
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
                @click='refresh(true)'
            />

            <TablerDropdown>
                <TablerIconButton
                    title='More Options'
                >
                    <IconDotsVertical
                        :size='32'
                        stroke='1'
                    />
                </TablerIconButton>

                <template #dropdown>
                    <div
                        style='min-width: 200px;'
                    >
                        <TablerDelete
                            displaytype='menu'
                            class='cloudtak-hover'
                            label='Delete All Features'
                            @click.stop
                            @delete='deleteFeatures'
                        />
                    </div>
                </template>
            </TablerDropdown>
        </template>
        <template #default>
            <div class='my-2'>
                <SearchSortFilter
                    v-model='query.filter'
                    v-model:sort='sort'
                    :sort-options='sortOptions'
                    :active-filters='activeFilterCount'
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
                    <template #filters>
                        <div class='d-flex flex-column'>
                            <div class='d-flex align-items-center justify-content-between px-3 py-2'>
                                <strong class='small text-uppercase text-white-50'>Filters</strong>
                                <button
                                    v-if='activeFilterCount > 0'
                                    type='button'
                                    class='btn btn-link btn-sm p-0'
                                    @click='clearGeometryFilters'
                                >
                                    Clear
                                </button>
                            </div>
                            <div class='px-3 pb-2 d-flex flex-column gap-2'>
                                <div>
                                    <div class='small text-uppercase text-white-50 mb-1'>
                                        Geometry
                                    </div>
                                    <label
                                        v-for='opt in geometryFilterOptions'
                                        :key='opt.value'
                                        class='form-check mb-1'
                                    >
                                        <input
                                            class='form-check-input'
                                            type='checkbox'
                                            :checked='geometryTypes.includes(opt.value)'
                                            @change='toggleGeometryType(opt.value)'
                                        >
                                        <span class='form-check-label d-flex align-items-center gap-1'>
                                            <component
                                                :is='opt.icon'
                                                :size='14'
                                                stroke='1'
                                            />
                                            {{ opt.label }}
                                        </span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </template>
                </SearchSortFilter>
            </div>

            <div class='my-2 d-flex align-items-center justify-content-between'>
                <PathBreadcrumb v-model:collection='collectionPath' />
                <TablerIconButton
                    title='Create Folder'
                    @click='folderModal.shown = true'
                >
                    <IconFolderPlus
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
            </div>

            <TablerLoading
                v-if='loading'
                v-model='query.filter'
                desc='Loading Features'
            />
            <template v-else>
                <div
                    v-if='currentPath === "/"'
                    class='pb-2'
                >
                    <StandardItem
                        class='d-flex align-items-center px-3 py-3 user-select-none'
                        @click='router.push("/menu/features/deleted")'
                    >
                        <IconTrash
                            :size='20'
                            stroke='1'
                            class='me-2'
                        /> Recently Deleted
                    </StandardItem>
                </div>

                <TablerNone
                    v-if='currentItems.size === 0 && currentFolders.length === 0'
                    :create='false'
                    :label='currentPath === "/" ? "No Archived Features" : "Folder is empty"'
                />

                <template v-else>
                    <PathBrowser
                        v-if='currentFolders.length'
                        :nodes='currentFolders'
                        :visibility-toggle='true'
                        :is-node-hidden='isFolderHidden'
                        @navigate='navigateToFolder'
                        @delete='deletePath'
                        @rename='openEditModal'
                        @folder-drop='onFolderDrop'
                        @toggle-visibility='toggleFolderVisibility'
                    />

                    <div
                        id='general'
                        ref='sortableFilesRef'
                        class='mt-2'
                    >
                        <Feature
                            v-for='cot of sortedItems'
                            :id='cot.id'
                            :key='cot.id'
                            :select='true'
                            :grip-handle='true'
                            :delete-button='true'
                            :info-button='true'
                            :visibility-toggle='true'
                            :feature='cot'
                        />
                    </div>
                </template>
            </template>
        </template>
    </MenuTemplate>
    <TablerModal
        v-if='folderModal.shown'
    >
        <div class='modal-status bg-white' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='folderModal.shown = false'
        />
        <div class='modal-header text-body'>
            <div class='modal-title'>
                {{ folderModal.editingNode ? 'Rename Folder' : 'Create Folder' }}
            </div>
        </div>
        <div class='modal-body'>
            <TablerInput
                v-model='folderModal.name'
                label='Folder Name'
                placeholder='Operations'
                @submit='submitFolder'
            />
        </div>
        <div class='modal-footer'>
            <TablerButton
                class='w-100'
                variant='primary'
                @click='submitFolder'
            >
                {{ folderModal.editingNode ? 'Save' : 'Create' }}
            </TablerButton>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import COT from '../../../base/cot.ts';
import FeatureManager from '../../../base/feature.ts';
import type { Feature_ExportFormat } from '../../../base/feature.ts';
import PathManager from '../../../base/path-manager.ts';
import type { PathNode } from '../../../base/path-manager.ts';
import { FeatureVisibility, GENERAL_SOURCE_ID } from '../../../stores/modules/feature-visibility.ts';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import SearchSortFilter from '../util/SearchSortFilter.vue';
import PathBrowser from '../util/PathBrowser.vue';
import PathBreadcrumb from '../util/PathBreadcrumb.vue';
import Feature from '../util/FeatureRow.vue';
import StandardItem from '../util/StandardItem.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerDelete,
    TablerDropdown,
    TablerIconButton,
    TablerRefreshButton,
    TablerModal,
    TablerButton
} from '@tak-ps/vue-tabler';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconFile,
    IconFolderPlus,
    IconTrash,
    IconDownload,
    IconDotsVertical,
    IconClock,
    IconLetterCase,
    IconArrowUp,
    IconArrowDown,
    IconPoint,
    IconLine,
    IconPolygon,
} from '@tabler/icons-vue';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs'
import { useMapStore } from '../../../stores/map.ts';

const router = useRouter();
const mapStore = useMapStore();

const sortableFilesRef = useTemplateRef<HTMLElement>('sortableFilesRef');
const sortables = new Map<string, Sortable>();

const channel = new BroadcastChannel("cloudtak");

channel.onmessage = async (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === WorkerMessageType.Feature_Archived_Added) {
        await refresh();
    } else if (msg.type === WorkerMessageType.Feature_Archived_Removed) {
        await refresh();
    }
}

const cots = ref<Set<COT>>(new Set());
const paths = ref<PathNode<COT>[]>([]);
const currentPath = ref('/');
const currentItems = ref<Set<COT>>(new Set());
const query = ref({
    filter: ''
})

const collectionPath = computed({
    get: () => currentPath.value === '/' ? '' : currentPath.value.slice(1),
    set: (val: string) => {
        navigateTo(val ? '/' + val : '/');
    }
});

const currentFolders = computed(() => {
    if (currentPath.value === '/') {
        return paths.value;
    }
    const node = PathManager.findNode(paths.value, currentPath.value);
    return node ? node.children : [];
});

function isFolderHidden(node: PathNode<COT>): boolean {
    return FeatureVisibility.isPathHidden(GENERAL_SOURCE_ID, node.fullPath);
}

function toggleFolderVisibility(node: PathNode<COT>): void {
    FeatureVisibility.togglePath(GENERAL_SOURCE_ID, node.fullPath);
}

const folderModal = ref<{
    shown: boolean;
    name: string;
    editingNode?: PathNode<COT>;
}>({
    shown: false,
    name: ''
});

const dragging = ref(false);
const draggedId = ref<string | undefined>();
const loading = ref(true);

const sortOptions = ['Newest → Oldest', 'Oldest → Newest', 'Alphabetical A→Z', 'Alphabetical Z→A'];
const sort = ref('Newest → Oldest');

const geometryFilterOptions = [
    { value: 'Point', label: 'Point', icon: IconPoint },
    { value: 'LineString', label: 'LineString', icon: IconLine },
    { value: 'Polygon', label: 'Polygon', icon: IconPolygon },
];

const geometryTypes = ref<string[]>([]);
const activeFilterCount = computed(() => geometryTypes.value.length);

function toggleGeometryType(type: string): void {
    if (geometryTypes.value.includes(type)) {
        geometryTypes.value = geometryTypes.value.filter(t => t !== type);
    } else {
        geometryTypes.value = [...geometryTypes.value, type];
    }
}

function clearGeometryFilters(): void {
    geometryTypes.value = [];
}

const sortTypeIcon = computed(() => sort.value.startsWith('Alphabetical') ? IconLetterCase : IconClock);
const sortDirectionIcon = computed(() => (sort.value === 'Oldest → Newest' || sort.value === 'Alphabetical A→Z') ? IconArrowUp : IconArrowDown);

const sortedItems = computed((): COT[] => {
    const arr = Array.from(currentItems.value);
    if (sort.value === 'Oldest → Newest') {
        return arr.sort((a, b) => {
            const ta = a.properties.time ? new Date(a.properties.time).getTime() : 0;
            const tb = b.properties.time ? new Date(b.properties.time).getTime() : 0;
            return ta - tb;
        });
    } else if (sort.value === 'Alphabetical A→Z') {
        return arr.sort((a, b) => {
            const ca = (a.properties.callsign ?? '').toLowerCase();
            const cb = (b.properties.callsign ?? '').toLowerCase();
            return ca.localeCompare(cb);
        });
    } else if (sort.value === 'Alphabetical Z→A') {
        return arr.sort((a, b) => {
            const ca = (a.properties.callsign ?? '').toLowerCase();
            const cb = (b.properties.callsign ?? '').toLowerCase();
            return cb.localeCompare(ca);
        });
    } else {
        // Newest → Oldest (default)
        return arr.sort((a, b) => {
            const ta = a.properties.time ? new Date(a.properties.time).getTime() : 0;
            const tb = b.properties.time ? new Date(b.properties.time).getTime() : 0;
            return tb - ta;
        });
    }
});



watch(query.value, async () => {
    await refresh();
})

watch(geometryTypes, async () => {
    await refresh();
})

onMounted(async () => {
    await refresh();
});

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
    }
})

function initSortable(element: HTMLElement, nodeId?: string): Sortable {
    const sortable = new Sortable(element, {
        sort: true,
        group: 'features',
        handle: '.drag-handle',
        dataIdAttr: 'id',
        onAdd: onFeatureAdd,
        onStart: (evt) => {
            dragging.value = true;
            draggedId.value = evt.item.id;
        },
        onEnd: () => {
            dragging.value = false;
            draggedId.value = undefined;
        }
    });

    if (nodeId) {
        sortables.set(nodeId, sortable);
    }

    return sortable;
}

function initRootSortable(): void {
    if (!sortableFilesRef.value) throw new Error('Could not load sortable');

    const existing = Sortable.get(sortableFilesRef.value);
    if (existing) existing.destroy();

    initSortable(sortableFilesRef.value);
}

function openEditModal(node: PathNode<COT>) {
    folderModal.value.name = node.fullPath;
    folderModal.value.editingNode = node;
    folderModal.value.shown = true;
}

async function submitFolder() {
    if (folderModal.value.editingNode) {
        await renameFolder();
    } else {
        createFolder();
    }
}

async function renameFolder() {
    if (!folderModal.value.name || !folderModal.value.editingNode) return;

    const newPath = PathManager.normalize(folderModal.value.name);
    const node = folderModal.value.editingNode;

    if (node.fullPath === newPath) {
        folderModal.value.shown = false;
        folderModal.value.editingNode = undefined;
        folderModal.value.name = '';
        return;
    }

    if (PathManager.hasPath(paths.value, newPath)) {
        folderModal.value.shown = false;
        folderModal.value.editingNode = undefined;
        folderModal.value.name = '';
        return;
    }

    // Collect all descendant paths that need updating
    const allPaths = PathManager.flatPaths([node]);

    for (const oldP of allPaths) {
        const newP = oldP.replace(node.fullPath, newPath);
        const cotsToUpdate = await mapStore.worker.db.pathFeatures(oldP);
        for (const cot of cotsToUpdate) {
            cot.path = newP;
        }
    }

    folderModal.value.shown = false;
    folderModal.value.editingNode = undefined;
    folderModal.value.name = '';

    await refresh();
}

function createFolder() {
    if (!folderModal.value.name) return;

    const prefix = currentPath.value === '/' ? '' : currentPath.value.slice(1) + '/';
    const name = PathManager.normalize(prefix + folderModal.value.name);

    if (PathManager.hasPath(paths.value, name)) {
        folderModal.value.shown = false;
        folderModal.value.name = '';
        return;
    }

    PathManager.addPath<COT>(paths.value, name);

    nextTick(() => {
        initRootSortable();
    });

    folderModal.value.shown = false;
    folderModal.value.name = '';
}

function deleteFromSet(set: Set<COT>, id: string) {
    for (const item of set) {
        if (String(item.id) === String(id)) {
            set.delete(item);
            return true;
        }
    }
    return false;
}

async function onFeatureAdd(ev: SortableEvent): Promise<void> {
    const id = ev.item.id;
    if (!id) return;

    const cot = await mapStore.worker.db.get(id);
    if (!cot) throw new Error("Marker Not Found");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let target = (ev as any).to.id
    if (!target) throw new Error("Sorting Error");

    if (target === 'general') {
        const sourceNode = PathManager.findNode<COT>(paths.value, cot.path);
        if (sourceNode) {
            deleteFromSet(sourceNode.items, cot.id);
            sourceNode.count--;
        }

        cot.path = '/';
        cots.value.add(cot);
    } else {
        target = target.replace('foldertarget-', '').replace('folder-', '');
        const targetNode = PathManager.findNodeById<COT>(paths.value, target);
        if (!targetNode) return;

        if (cot.path === '/') {
            cot.path = targetNode.fullPath;
            deleteFromSet(cots.value, cot.id);
            targetNode.items.add(cot);
            targetNode.count++;
        } else {
            const sourceNode = PathManager.findNode<COT>(paths.value, cot.path);
            if (!sourceNode) return;
            deleteFromSet(sourceNode.items, cot.id);
            sourceNode.count--;

            cot.path = targetNode.fullPath;
            targetNode.items.add(cot);
            targetNode.count++;
        }
    }
}

async function onFolderDrop(node: PathNode<COT>) {
    if (!draggedId.value) return;
    const id = draggedId.value;

    const cot = await mapStore.worker.db.get(id);
    if (!cot) return;

    if (cot.path === node.fullPath) return;

    if (cot.path === '/') {
         deleteFromSet(cots.value, cot.id);
    } else {
         const sourceNode = PathManager.findNode<COT>(paths.value, cot.path);
         if (sourceNode) {
             deleteFromSet(sourceNode.items, cot.id);
             sourceNode.count--;
         }
    }

    node.items.add(cot);
    node.count++;

    cot.path = node.fullPath;
}

async function refresh(load = false): Promise<void> {
    if (load) loading.value = true;

    let geomFilter = '';
    if (geometryTypes.value.length > 0) {
        const clauses = geometryTypes.value.flatMap(t => {
            if (t === 'Point') return ['geometry.type = "Point"', 'geometry.type = "MultiPoint"'];
            if (t === 'LineString') return ['geometry.type = "LineString"', 'geometry.type = "MultiLineString"'];
            if (t === 'Polygon') return ['geometry.type = "Polygon"', 'geometry.type = "MultiPolygon"'];
            return [];
        });
        geomFilter = `and (${clauses.join(' or ')})`;
    }

    cots.value = new Set(Array.from(await mapStore.worker.db
        .filter(`
            properties.archived
            and path = "/"
            and $contains($lowercase(properties.callsign), "${query.value.filter.toLowerCase()}")
            ${geomFilter}
        `)))

    const flatPaths = (await mapStore.worker.db.paths())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((p: any) => p.path !== '/');

    paths.value = PathManager.buildTree<COT>(flatPaths);

    // Reload items for the current folder if navigated into one
    if (currentPath.value !== '/') {
        const node = PathManager.findNode(paths.value, currentPath.value);
        if (node) {
            node.items = await mapStore.worker.db.pathFeatures(node.fullPath);
            currentItems.value = node.items;
        } else {
            // Folder no longer exists, navigate back to root
            currentPath.value = '/';
            currentItems.value = cots.value;
        }
    } else {
        currentItems.value = cots.value;
    }

    loading.value = false

    nextTick(() => {
        if (currentItems.value.size === 0) return;

        if (!sortableFilesRef.value) return;

        initSortable(sortableFilesRef.value);
    })
}

async function download(format: Feature_ExportFormat): Promise<void> {
    await FeatureManager.download({ format });
}

async function navigateToFolder(node: PathNode<COT>): Promise<void> {
    node.items = await mapStore.worker.db.pathFeatures(node.fullPath);
    currentPath.value = node.fullPath;
    currentItems.value = node.items;

    nextTick(() => {
        if (!sortableFilesRef.value) return;
        initSortable(sortableFilesRef.value);
    });
}

async function navigateTo(path: string): Promise<void> {
    if (path !== '/') {
        const node = PathManager.findNode(paths.value, path);
        if (node) {
            node.items = await mapStore.worker.db.pathFeatures(node.fullPath);
            currentItems.value = node.items;
        }
    } else {
        currentItems.value = cots.value;
    }

    currentPath.value = path;

    nextTick(() => {
        if (!sortableFilesRef.value) return;
        initSortable(sortableFilesRef.value);
    });
}

async function deleteFeatures(): Promise<void> {
    try {
        loading.value = true;

        await mapStore.worker.db.filterRemove(`properties.archived`, {
            skipNetwork: true
        });

        await FeatureManager.delete();

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deletePath(node: PathNode<COT>): Promise<void> {
    // Destroy sortable instances for this node and all descendants
    const destroySortables = (n: PathNode<COT>) => {
        const sortable = sortables.get(n.id);
        if (sortable) {
            sortable.destroy();
            sortables.delete(n.id);
        }
        for (const child of n.children) {
            destroySortables(child);
        }
    };
    destroySortables(node);

    // Delete COTs for this path and all descendant paths
    const allPaths = PathManager.flatPaths([node]);
    for (const p of allPaths) {
        await FeatureManager.delete({ path: p, permanent: true });
        const cots = await mapStore.worker.db.pathFeatures(p);
        await Promise.allSettled([...cots].map((cot) => mapStore.worker.db.remove(cot.id, { skipNetwork: true })));
    }

    await refresh();
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
