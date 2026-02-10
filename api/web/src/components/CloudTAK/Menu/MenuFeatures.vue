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
                @click='folderManager?.openCreateModal()'
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
                    <FolderManager
                        ref='folderManager'
                        :folders='paths'
                        :files='cots'
                        folder-items-key='cots'
                        @folder-open='openPath'
                        @folder-close='closePath'
                        @create-folder='createFolder'
                        @rename-folder='renameFolder'
                        @delete-folder='deletePath'
                        @move-file='moveFile'
                        @drop-file-on-folder='dropFileOnFolder'
                    >
                        <template #file='{ file }'>
                            <Feature
                                :id='file.id'
                                :key='file.id'
                                :select='true'
                                :grip-handle='true'
                                :delete-button='true'
                                :info-button='true'
                                :feature='file'
                            />
                        </template>
                    </FolderManager>
                </div>
            </template>
        </template>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { v4 as randomUUID } from 'uuid';
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import COT from '../../../base/cot.ts';
import { useRouter } from 'vue-router';
import MenuTemplate from '../util/MenuTemplate.vue';
import Feature from '../util/FeatureRow.vue';
import StandardItem from '../util/StandardItem.vue';
import FolderManager from '../util/FolderManager.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerDelete,
    TablerDropdown,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import { std } from '../../../std.ts';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconFile,
    IconFolderPlus,
    IconTrash,
    IconDownload,
    IconDotsVertical
} from '@tabler/icons-vue';
import { useMapStore } from '../../../stores/map.ts';

const router = useRouter();
const mapStore = useMapStore();

type Path = {
    id: string;
    name: string;
    count: number;
    opened: boolean;
    loading: boolean;
    cots: Set<COT>;
};

const folderManager = ref();

// channel... logic remains
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

const loading = ref(true);

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

async function renameFolder(payload: { folder: Path, name: string }) {
    let newName = payload.name;
    if (!newName.startsWith('/')) newName = '/' + newName;
    const path = payload.folder;

    if (path.name === newName) return;

    if (paths.value.some(p => p.name === newName)) return;

    const cotsToUpdate = await mapStore.worker.db.pathFeatures(path.name);

    for (const cot of cotsToUpdate) {
        cot.path = newName;
    }

    path.name = newName;
    paths.value.sort((a, b) => a.name.localeCompare(b.name));

    await refresh();
}

function createFolder(name: string) {
    if (!name) return;

    let pathName = name;
    if (!pathName.startsWith('/')) pathName = '/' + pathName;

    if (paths.value.some(p => p.name === pathName)) return;

    const newPath: Path = {
        id: randomUUID(),
        name: pathName,
        count: 0,
        opened: true,
        loading: false,
        cots: new Set()
    };

    paths.value.push(newPath);
    paths.value.sort((a, b) => a.name.localeCompare(b.name));
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

async function moveFile(payload: { id: string, targetId: string | null }): Promise<void> {
    const id = payload.id;
    const targetFolderId = payload.targetId;

    const cot = await mapStore.worker.db.get(id);
    if (!cot) throw new Error("Marker Not Found");

    // Remove from old location
    if (cot.path === '/') {
        deleteFromSet(cots.value, cot.id);
    } else {
        const sourcePath = paths.value.find(p => p.name === cot.path);
        if (sourcePath) {
            deleteFromSet(sourcePath.cots, cot.id);
            sourcePath.count--;
        }
    }

    if (targetFolderId === null) {
        // Moved to root
        cot.path = '/';
        cots.value.add(cot);
    } else {
        // Moved to folder
        const ps = paths.value.filter((p) => {
            return p.id === targetFolderId;
        });

        if (ps.length === 1) {
            const p = ps[0];
            cot.path = p.name;
            p.cots.add(cot);
            p.count++;
        } else {
             // Fallback or error?
        }
    }
}

async function dropFileOnFolder(payload: { id: string, folder: Path }) {
    const { id, folder } = payload;

    const cot = await mapStore.worker.db.get(id);
    if (!cot) return;

    if (cot.path === folder.name) return;

    if (cot.path === '/') {
         deleteFromSet(cots.value, cot.id);
    } else {
         const sourcePath = paths.value.find(p => p.name === cot.path);
         if (sourcePath) {
             deleteFromSet(sourcePath.cots, cot.id);
             sourcePath.count--;
         }
    }

    folder.cots.add(cot);
    folder.count++;

    cot.path = folder.name;
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

    loading.value = false;
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
    await mapStore.worker.db.filterRemove(`path = "${path.name}" and properties.archived`);
    await refresh();
}

async function openPath(path: Path): Promise<void> {
    path.opened = true;
    path.loading = true;
    path.cots = await mapStore.worker.db.pathFeatures(path.name);
    path.loading = false;
}

</script>
