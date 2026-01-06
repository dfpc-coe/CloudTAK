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
                        class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
                        @click.stop.prevent='download("geojson")'
                    >
                        <IconFile
                            :size='32'
                            stroke='1'
                        />
                        <span class='mx-2'>GeoJSON</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 hover d-flex align-items-center px-2 py-2'
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

            <TablerIconButton
                title='Create Folder'
                @click='folderModal.shown = true'
            >
                <IconFolderPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>

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
                            class='hover'
                            label='Delete All Features'
                            @delete='deleteFeatures'
                        />
                    </div>
                </template>
            </TablerDropdown>
        </template>
        <template #default>
            <div class='mx-2 my-2'>
                <TablerInput
                    v-model='query.filter'
                    icon='search'
                    placeholder='Search'
                />
            </div>
            <TablerLoading
                v-if='loading'
                v-model='query.filter'
                desc='Loading Features'
            />
            <TablerNone
                v-else-if='cots.size === 0 && paths.length === 0'
                :create='false'
                label='Archived Features'
            />
            <template v-else>
                <div class='px-2 pb-2'>
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

                <div class='d-flex flex-column gap-2 px-2'>
                    <template
                        v-for='path of paths'
                        :key='path.id'
                    >
                        <StandardItem
                            class='px-3 py-3 user-select-none'
                            :style='hover === path ? "background-color: rgba(255, 255, 255, 0.1);" : ""'
                            :id='`foldertarget-${path.id}`'
                            @drop.stop.prevent='onFolderDrop(path, $event)'
                            @dragover.prevent='dragOverFolder(path)'
                            @dragleave='dragLeaveFolder()'
                            @click='path.opened ? closePath(path) : openPath(path)'
                        >
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="d-flex align-items-center">
                                    <IconChevronRight
                                        v-if='!path.opened'
                                        :size='20'
                                        stroke='1'
                                    />
                                    <IconChevronDown
                                        v-else
                                        :size='20'
                                        stroke='1'
                                    />
                                    <IconFolder
                                        class='mx-2'
                                        :size='20'
                                        stroke='2'
                                    />
                                    <span
                                        class="fw-bold"
                                        v-text='path.name.replace(/(^\/|\/$)/g, "")'
                                    />
                                </div>

                                <div class='ms-auto d-flex align-items-center gap-2'>
                                    <span class='badge rounded-pill bg-secondary bg-opacity-25 text-white-50'>{{ path.count }}</span>
                                    <TablerIconButton
                                        title='Rename Folder'
                                        @click.stop='openEditModal(path)'
                                    >
                                        <IconPencil
                                            :size='20'
                                            stroke='1'
                                        />
                                    </TablerIconButton>
                                    <TablerDelete
                                        displaytype='Icon'
                                        :size='20'
                                        @delete='deletePath(path)'
                                    />
                                </div>
                            </div>
                            
                            <div
                                v-if='path.opened'
                                class='mt-3'
                                @click.stop
                            >
                                <div
                                    :id='`folder-${path.id}`'
                                    class='folder w-100'
                                    style='min-height: 40px;'
                                >
                                    <TablerLoading v-if='path.loading' />
                                    <template v-else>
                                        <div
                                            v-if="path.cots.size === 0"
                                            class="text-center text-muted fst-italic py-2 small user-select-none opacity-50 pe-none position-absolute w-100"
                                            style="margin-top: -8px;"
                                        >
                                            Folder is empty
                                        </div>
                                        <Feature
                                            v-for='cot of path.cots.values()'
                                            :id='cot.id'
                                            :key='cot.id'
                                            :select='true'
                                            :grip-handle='true'
                                            :delete-button='true'
                                            :info-button='true'
                                            :feature='cot'
                                        />
                                    </template>
                                </div>
                            </div>
                        </StandardItem>
                    </template>
                </div>

                <div
                    id='general'
                    class='px-2 mt-2'
                    ref='sortableFilesRef'
                >
                    <Feature
                        v-for='cot of cots.values()'
                        :id='cot.id'
                        :key='cot.id'
                        :select='true'
                        :grip-handle='true'
                        :delete-button='true'
                        :info-button='true'
                        :feature='cot'
                    />
                </div>
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
        <div class='modal-header text-white'>
            <div class='modal-title'>
                {{ folderModal.editingPath ? 'Rename Folder' : 'Create Folder' }}
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
                {{ folderModal.editingPath ? 'Save' : 'Create' }}
            </TablerButton>
        </div>
    </TablerModal></template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, watch, nextTick, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import COT from '../../../base/cot.ts';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
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
import { std } from '../../../std.ts';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconFile,
    IconFolder,
    IconFolderPlus,
    IconTrash,
    IconPencil,
    IconDownload,
    IconDotsVertical,
    IconChevronRight,
    IconChevronDown
} from '@tabler/icons-vue';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs'
import { useMapStore } from '../../../stores/map.ts';

const router = useRouter();
const mapStore = useMapStore();

type Path = {
    id: string;
    name: string;
    count: number;
    opened: boolean;
    loading: boolean;
    sortable?: Sortable;
    cots: Set<COT>;
};

const sortableFilesRef = useTemplateRef<HTMLElement>('sortableFilesRef');

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
const paths = ref<Array<Path>>([]);
const query = ref({
    filter: ''
})

const folderModal = ref<{
    shown: boolean;
    name: string;
    editingPath?: Path;
}>({
    shown: false,
    name: ''
});

const dragging = ref(false);
const draggedId = ref<string | undefined>();
const loading = ref(true);

const hover = ref<Path | undefined>();
const hoverTimer = ref<ReturnType<typeof setTimeout> | undefined>();

watch(query.value, async () => {
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

function openEditModal(path: Path) {
    folderModal.value.name = path.name;
    folderModal.value.editingPath = path;
    folderModal.value.shown = true;
}

async function submitFolder() {
    if (folderModal.value.editingPath) {
        await renameFolder();
    } else {
        createFolder();
    }
}

async function renameFolder() {
    if (!folderModal.value.name || !folderModal.value.editingPath) return;

    let newName = folderModal.value.name;
    if (!newName.startsWith('/')) newName = '/' + newName;
    const path = folderModal.value.editingPath;

    if (path.name === newName) {
        folderModal.value.shown = false;
        folderModal.value.editingPath = undefined;
        folderModal.value.name = '';
        return;
    }

    if (paths.value.some(p => p.name === newName)) {
        folderModal.value.shown = false;
        folderModal.value.editingPath = undefined;
        folderModal.value.name = '';
        return;
    }

    const cotsToUpdate = await mapStore.worker.db.pathFeatures(path.name);

    for (const cot of cotsToUpdate) {
        cot.path = newName;
    }

    path.name = newName;
    paths.value.sort((a, b) => a.name.localeCompare(b.name));

    folderModal.value.shown = false;
    folderModal.value.editingPath = undefined;
    folderModal.value.name = '';

    await refresh();
}

function createFolder() {
    if (!folderModal.value.name) return;
    
    let name = folderModal.value.name;
    if (!name.startsWith('/')) name = '/' + name;
    
    if (paths.value.some(p => p.name === name)) {
        folderModal.value.shown = false;
        folderModal.value.name = '';
        return;
    }

    const newPath: Path = {
        id: randomUUID(),
        name: name,
        count: 0,
        opened: true,
        loading: false,
        cots: new Set()
    };

    paths.value.push(newPath);
    paths.value.sort((a, b) => a.name.localeCompare(b.name));

    nextTick(() => {
        const folderDiv = document.getElementById(`folder-${newPath.id}`);
        if (folderDiv) {
             newPath.sortable = new Sortable(folderDiv, {
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
            })
        }

        if (!sortableFilesRef.value) throw new Error('Could not load sortable');

        // Re-init global sortable to include new folder
        const sortable = Sortable.get(sortableFilesRef.value);
        if (sortable) sortable.destroy();

        new Sortable(sortableFilesRef.value, {
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
        const ps = paths.value.filter((p) => { return p.name === cot.path; });
        if (ps.length) {
            deleteFromSet(ps[0].cots, cot.id);
            ps[0].count--;
        }

        cot.path = '/';
        cots.value.add(cot);
    } else {
        target = target.replace('foldertarget-', '').replace('folder-', '');
        const ps = paths.value.filter((p) => {
            return p.id === target;
        });

        if (ps.length !== 1) return;
        const p = ps[0];

        if (cot.path === '/') {
            cot.path = p.name;
            deleteFromSet(cots.value, cot.id);
            p.cots.add(cot);
            p.count++;
        } else {
            const ps = paths.value.filter((p) => { return p.name === cot.path; });
            if (ps.length !== 1) return;
            deleteFromSet(ps[0].cots, cot.id);
            ps[0].count--;

            cot.path = p.name;
            p.cots.add(cot);
            p.count++;
        }
    }
}

async function dragOverFolder(path: Path): Promise<void> {
    if (!dragging.value || path.opened) return;

    if (!path.opened) {
        hover.value = path;
        hoverTimer.value = setTimeout(async () => {
            await openPath(path);

            clearTimeout(hoverTimer.value);
            hoverTimer.value = undefined;
        }, 500);
    }
}

async function dragLeaveFolder(): Promise<void> {
    hover.value = undefined;

    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value);
        hoverTimer.value = undefined;
    }
}

async function onFolderDrop(path: Path, event: DragEvent) {
    // If we dropped inside the actual sortable list, let Sortable handle it
    if (path.opened) return;

    if (!draggedId.value) return;
    const id = draggedId.value;

    const cot = await mapStore.worker.db.get(id);
    if (!cot) return;

    if (cot.path === path.name) return;

    if (cot.path === '/') {
         deleteFromSet(cots.value, cot.id);
    } else {
         const sourcePath = paths.value.find(p => p.name === cot.path);
         if (sourcePath) {
             deleteFromSet(sourcePath.cots, cot.id);
             sourcePath.count--;
         }
    }

    path.cots.add(cot);
    path.count++;

    cot.path = path.name;
}

async function refresh(load = false): Promise<void> {
    if (load) loading.value = true;

    cots.value = new Set(Array.from(await mapStore.worker.db
        .filter(`
            properties.archived
            and path = "/"
            and $contains($lowercase(properties.callsign), "${query.value.filter.toLowerCase()}")
        `)))

    paths.value = (await mapStore.worker.db.paths())
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => {
            if (a.path < b.path) {
                return -1;
            } else if (a.path > b.path) {
                return 1;
            } else {
              return 0;
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).filter((path: any) => {
            return path.path !== '/'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).map((path: any) => {
            return {
                id: randomUUID(),
                name: path.path,
                count: path.count,
                opened: false,
                loading: false,
                cots: new Set()
            }
        });

    loading.value = false

    nextTick(() => {
        // Sortable will throw an error if there are no sortable objects
        if (cots.value.size === 0) return;

        if (!sortableFilesRef.value) throw new Error('Could not load sortable');

        new Sortable(sortableFilesRef.value, {
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
        })
    })
}

async function download(format: string): Promise<void> {
    await std(`/api/profile/feature?format=${format}&download=true&token=${localStorage.token}`, {
        download: true
    });
}

async function closePath(path: Path): Promise<void> {
    path.opened = false;
    path.cots.clear();
}

async function deleteFeatures(): Promise<void> {
    try {
        loading.value = true;

        await mapStore.worker.db.filterRemove(`properties.archived`, {
            skipNetwork: true
        });

        await std('/api/profile/feature', {
            method: 'DELETE'
        });

        loading.value = false;
    } catch (err) {
        loading.value = false;
        throw err;
    }
}

async function deletePath(path: Path): Promise<void> {
    if (path.sortable) {
        path.sortable.destroy();
        path.sortable = undefined;
    }

    await mapStore.worker.db.filterRemove(`path = "${path.name}" and properties.archived`);
    await refresh();
}

async function openPath(path: Path): Promise<void> {
    path.opened = true;
    path.loading = true;
    path.cots = await mapStore.worker.db.pathFeatures(path.name);
    path.loading = false;

    nextTick(() => {
        const folderDiv = document.getElementById(`folder-${path.id}`);
        if (!folderDiv) throw new Error('Could not load sortable');

        path.sortable = new Sortable(folderDiv, {
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
        })
    });
}

</script>
