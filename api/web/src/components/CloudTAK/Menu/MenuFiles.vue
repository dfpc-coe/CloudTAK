<template>
    <MenuTemplate name='User Files'>
        <template #buttons>
            <TablerIconButton
                v-if='!loading && !upload'
                title='File Upload'
                @click='upload = true'
            >
                <IconUpload
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
                v-if='upload'
                class='py-2'
            >
                <Upload
                    :url='stdurl(`/api/import`)'
                    :headers='uploadHeaders()'
                    method='PUT'
                    @cancel='upload = false'
                    @done='uploadComplete($event)'
                />
            </div>

            <div class='col-12 pt-2'>
                <TablerInput
                    v-model='paging.filter'
                    icon='search'
                    placeholder='Filter'
                />
            </div>

            <div class='col-12 pt-2 d-flex align-items-center justify-content-between'>
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
            />
            <TablerAlert
                v-else-if='error'
                :err='error'
            />
            <TablerNone
                v-else-if='!currentFolders.length && !currentFiles.length'
                :label='currentPath === "/" ? "No Uploaded Files" : "Folder is empty"'
                :create='false'
            />
            <template v-else>
                <PathBrowser
                    v-if='currentFolders.length'
                    :nodes='currentFolders'
                    @navigate='navigateToFolder'
                    @delete='deletePath'
                    @rename='openEditModal'
                />

                <div class='mt-2 d-flex flex-column gap-2'>
                    <FileRow
                        v-for='asset in currentFiles'
                        :key='asset.id'
                        :asset='asset'
                        :overlay-urls='overlayUrls'
                        :rename='rename'
                        @create-overlay='createOverlay'
                        @download='downloadAsset'
                        @share-mission='shareToMission = $event'
                        @share-package='shareToPackage = $event'
                        @rename='rename = { id: $event.id, name: $event.name, loading: false }'
                        @rename-submit='renameAsset'
                        @rename-cancel='rename = undefined'
                        @delete='deleteAsset'
                        @move='openMoveModal($event)'
                    />
                </div>

                <div class='col-12 d-flex justify-content-center pt-3'>
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

    <ShareToMission
        v-if='shareToMission'
        :assets='[{
            type: "profile",
            id: shareToMission.id,
            name: shareToMission.name
        }]'
        @close='shareToMission = undefined'
    />

    <ShareToPackage
        v-if='shareToPackage'
        :name='shareToPackage.name'
        :assets='[{
            type: "profile",
            id: shareToPackage.id,
            name: shareToPackage.name
        }]'
        @close='shareToPackage = undefined'
    />

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
                placeholder='Documents'
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

    <TablerModal
        v-if='moveModal.shown'
    >
        <div class='modal-status bg-white' />
        <button
            type='button'
            class='btn-close'
            aria-label='Close'
            @click='moveModal.shown = false'
        />
        <div class='modal-header text-body'>
            <div class='modal-title'>Move File to Folder</div>
        </div>
        <div class='modal-body'>
            <div
                class='cursor-pointer rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                @click='moveToPath("/")'
            >
                <IconFolder
                    :size='20'
                    stroke='1'
                    class='me-2'
                />
                <span>/ (Root)</span>
            </div>
            <div
                v-for='p in allPaths'
                :key='p'
                class='cursor-pointer rounded col-12 cloudtak-hover d-flex align-items-center px-2 py-2 user-select-none'
                @click='moveToPath(p)'
            >
                <IconFolder
                    :size='20'
                    stroke='1'
                    class='me-2'
                />
                <span v-text='p' />
            </div>
        </div>
    </TablerModal>
</template>

<script setup lang='ts'>
import { useRouter } from 'vue-router';
import { ref, watch, onMounted, computed } from 'vue';
import type { ProfileFile, ProfileFileList } from '../../../types.ts';
import PathManager from '../../../base/path-manager.ts';
import type { PathNode } from '../../../base/path-manager.ts';
import { std, stdurl, server } from '../../../std.ts';
import {
    TablerDelete,
    TablerIconButton,
    TablerRefreshButton,
    TablerInput,
    TablerPager,
    TablerAlert,
    TablerNone,
    TablerLoading,
    TablerBytes,
    TablerEpoch,
    TablerModal,
    TablerButton
} from '@tak-ps/vue-tabler';
import {
    IconAmbulance,
    IconPackage,
    IconUpload,
    IconMapOff,
    IconMapPlus,
    IconDownload,
    IconCursorText,
    IconFolder,
    IconFolderPlus,
    IconFolderSymlink,
} from '@tabler/icons-vue';
import PathBreadcrumb from '../util/PathBreadcrumb.vue';
import ShareToPackage from '../util/ShareToPackage.vue';
import ShareToMission from '../util/ShareToMission.vue';
import PathBrowser from '../util/PathBrowser.vue';
import FileRow from './MenuFilesRow.vue';
import MenuTemplate from '../util/MenuTemplate.vue';
import { useMapStore } from '../../../stores/map.ts';
import Overlay from '../../../base/overlay.ts';
import Upload from '../../util/Upload.vue';

const mapStore = useMapStore();

const overlayUrls = computed<Set<string>>(() => {
    return new Set(
        mapStore.overlays
            .filter((overlay) => overlay.mode === 'profile' && overlay.url)
            .map((overlay) => overlay.url as string)
    );
});

const router = useRouter();
const upload = ref(false)
const shareToPackage = ref<ProfileFile | undefined>();
const shareToMission = ref<ProfileFile | undefined>();
const rename = ref<{
    id: string;
    loading: boolean;
    name: string;
} | undefined>();
const error = ref<Error | undefined>(undefined);
const loading = ref(true);

const list = ref<ProfileFileList>({
    total: 0,
    tiles: { url: '' },
    items: [],
});

const paths = ref<PathNode<ProfileFile>[]>([]);
const rootFiles = ref<ProfileFile[]>([]);
const currentPath = ref('/');

const currentPathName = computed(() => {
    return PathManager.displayName(currentPath.value);
});

const collectionPath = computed({
    get: () => currentPath.value === '/' ? '' : currentPath.value.slice(1),
    set: (val: string) => { currentPath.value = val ? '/' + val : '/'; }
});

const currentFolders = computed(() => {
    if (currentPath.value === '/') {
        return paths.value;
    }
    const node = PathManager.findNode(paths.value, currentPath.value);
    return node ? node.children : [];
});

const currentFiles = computed(() => {
    if (currentPath.value === '/') {
        return rootFiles.value;
    }
    const node = PathManager.findNode(paths.value, currentPath.value);
    return node ? Array.from(node.items) : [];
});

const folderModal = ref<{
    shown: boolean;
    name: string;
    editingNode?: PathNode<ProfileFile>;
}>({
    shown: false,
    name: ''
});

const moveModal = ref<{
    shown: boolean;
    asset?: ProfileFile;
}>({
    shown: false
});

const allPaths = computed(() => {
    return PathManager.flatPaths(paths.value);
});

const paging = ref({
    page: 0,
    filter: '',
    limit: 100
})

onMounted(async () => {
    await fetchList();
});

watch(paging.value, async () => {
    await fetchList();
});

function buildPathTree() {
    const pathCounts = new Map<string, number>();
    const pathItems = new Map<string, ProfileFile[]>();

    for (const item of list.value.items) {
        const p = item.path || '/';
        if (p !== '/') {
            pathCounts.set(p, (pathCounts.get(p) || 0) + 1);
            if (!pathItems.has(p)) pathItems.set(p, []);
            pathItems.get(p)!.push(item);
        }
    }

    const flatPaths = Array.from(pathCounts.entries()).map(([path, count]) => ({ path, count }));
    paths.value = PathManager.buildTree<ProfileFile>(flatPaths);

    // Populate items into opened nodes
    const populateItems = (nodes: PathNode<ProfileFile>[]) => {
        for (const node of nodes) {
            const items = pathItems.get(node.fullPath);
            if (items) {
                node.items = new Set(items);
            }
            // For intermediate nodes that have no direct items but have the path match
            if (node.children.length) {
                populateItems(node.children);
            }
        }
    };
    populateItems(paths.value);

    rootFiles.value = list.value.items.filter(i => !i.path || i.path === '/');
}

function navigateToFolder(node: PathNode<ProfileFile>) {
    currentPath.value = node.fullPath;
}

function openEditModal(node: PathNode<ProfileFile>) {
    folderModal.value.name = node.fullPath;
    folderModal.value.editingNode = node;
    folderModal.value.shown = true;
}

function openMoveModal(asset: ProfileFile) {
    moveModal.value.asset = asset;
    moveModal.value.shown = true;
}

async function moveToPath(newPath: string) {
    const asset = moveModal.value.asset;
    if (!asset) return;

    const normalized = PathManager.normalize(newPath);

    moveModal.value.shown = false;
    moveModal.value.asset = undefined;

    if (asset.path === normalized) return;

    const res = await server.PATCH('/api/profile/asset/{:asset}', {
        params: {
            path: {
                ':asset': asset.id
            }
        },
        body: {
            path: normalized
        }
    });

    if (res.error) throw new Error(res.error.message);

    await fetchList();
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

    // Update all files in this folder and descendants
    const allNodePaths = PathManager.flatPaths([node]);

    for (const oldP of allNodePaths) {
        const newP = oldP.replace(node.fullPath, newPath);
        const items = list.value.items.filter(i => i.path === oldP);
        for (const item of items) {
            const res = await server.PATCH('/api/profile/asset/{:asset}', {
                params: {
                    path: {
                        ':asset': item.id
                    }
                },
                body: {
                    path: newP
                }
            });

            if (res.error) throw new Error(res.error.message);
        }
    }

    folderModal.value.shown = false;
    folderModal.value.editingNode = undefined;
    folderModal.value.name = '';

    await fetchList();
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

    const newNode = PathManager.addPath<ProfileFile>(paths.value, name);
    newNode.opened = true;

    folderModal.value.shown = false;
    folderModal.value.name = '';
}

async function deletePath(node: PathNode<ProfileFile>) {
    loading.value = true;

    try {
        const allNodePaths = PathManager.flatPaths([node]);

        for (const p of allNodePaths) {
            const items = list.value.items.filter(i => i.path === p);
            for (const item of items) {
                const res = await server.DELETE('/api/profile/asset/{:asset}', {
                    params: {
                        path: {
                            ':asset': item.id
                        }
                    }
                });

                if (res.error) throw new Error(res.error.message);
            }
        }

        await fetchList();
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function createOverlay(asset: ProfileFile) {
    if (!asset.artifacts.map(a => a.ext).includes(".pmtiles")) throw new Error('Cannot add an Overlay for an asset that is not Cloud Optimized');

    const url = stdurl(`/api/profile/asset/${encodeURIComponent(asset.id)}.pmtiles/tile`);

    loading.value = true;

    // TODO type PMTiles endpoints
    const res = await std(url) as {
        tiles: [ string ];
    };

    if (new URL(res.tiles[0]).pathname.endsWith('.mvt')) {
        mapStore.addOverlay(await Overlay.create({
            url: String(url),
            name: asset.name,
            mode: 'profile',
            mode_id: asset.name,
            iconset: asset.iconset,
            type: 'vector',
        }, {
            before: mapStore.getOverlayBeforeId()
        }));
    } else {
        mapStore.addOverlay(await Overlay.create({
            url: String(url),
            name: asset.name,
            mode: 'profile',
            mode_id: asset.name,
            iconset: asset.iconset,
            type: 'raster',
        }, {
            before: mapStore.getOverlayBeforeId()
        }));
    }

    loading.value = false;

    router.push('/menu/overlays');
}

function uploadHeaders() {
    return {
        Authorization: `Bearer ${localStorage.token}`
    };
}

function uploadComplete(event: unknown) {
    upload.value = false;
    const imp = event as { imports: Array<{ uid: string }> };
    router.push(`/menu/imports/${imp.imports[0].uid}`)
}

async function downloadAsset(asset: ProfileFile) {
    const url = stdurl(`/api/profile/asset/${asset.id}.${asset.name.split('.').pop()}`);
    url.searchParams.set('token', localStorage.token);
    window.open(url, "_blank")
}

async function renameAsset() {
    if (!rename.value) return;

    rename.value.loading = true;

    try {
        const res = await server.PATCH('/api/profile/asset/{:asset}', {
            params: {
                path: {
                    ':asset': rename.value.id
                },
            },
            body: {
                name: rename.value.name
            }
        });

        if (res.error) throw new Error(res.error.message);

        for (const item of list.value.items) {
            if (item.id === rename.value.id) {
                item.name = rename.value.name;
                break;
            }
        }

        rename.value = undefined;
    } catch (err) {
        if (rename.value) rename.value.loading = false;
        throw err;
    }
}

async function fetchList() {
    try {
        loading.value = true;
        error.value = undefined;

        const res = await server.GET(`/api/profile/asset`, {
            params: {
                query: {
                    filter: paging.value.filter,
                    order: 'desc',
                    sort: 'created',
                    limit: paging.value.limit,
                    page: paging.value.page
                }
            }
        });

        if (res.error) throw new Error(res.error.message);

        list.value = res.data;
        buildPathTree();
        loading.value = false;
    } catch (err) {
        error.value = err instanceof Error ? err : new Error(String(err));
    }
}

async function deleteAsset(asset: ProfileFile) {
    loading.value = true;

    try {
        const res = await server.DELETE('/api/profile/asset/{:asset}', {
            params: {
                path: {
                    ':asset': asset.id
                }
            }
        });

        if (res.error) throw new Error(res.error.message);
    } catch (err) {
        loading.value = false
        throw err;
    }

    await fetchList();
}
</script>
