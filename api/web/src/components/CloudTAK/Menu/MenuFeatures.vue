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
                v-else-if='cots.size === 0'
                :create='false'
                label='Archived Features'
            />
            <template v-else>
                <template
                    v-for='path of paths'
                    :key='path'
                >
                    <div
                        class='d-flex align-items-center px-3 py-2 me-2 hover-button cursor-pointer user-select-none'
                        :style='hover === path ? "background-color: rgba(0, 0, 0, 0.2);" : ""'
                        @dragover.prevent='dragOverFolder(path)'
                        @dragleave='dragLeaveFolder()'
                        @click='path.opened ? closePath(path) : openPath(path)'
                    >
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
                        <span v-text='path.name.replace(/(^\/|\/$)/g, "")' />

                        <div class='ms-auto btn-list hover-button-hidden'>
                            <TablerDelete
                                displaytype='Icon'
                                :size='20'
                                @delete='deletePath(path)'
                            />
                        </div>
                    </div>
                    <div
                        v-if='path.opened'
                        class='ms-2'
                    >
                        <div
                            :id='`folder-${path.id}`'
                            class='folder'
                        >
                            <TablerLoading v-if='path.loading' />
                            <template v-else>
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
                </template>

                <div
                    id='general'
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
</template>

<script setup lang='ts'>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import { stdurl } from '../../../std.ts';
import COT from '../../../base/cot.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import Feature from '../util/FeatureRow.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerDelete,
    TablerDropdown,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import { std } from '../../../std.ts';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconFile,
    IconFolder,
    IconDownload,
    IconDotsVertical,
    IconChevronRight,
    IconChevronDown
} from '@tabler/icons-vue';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs'
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

type Path = {
    id: string;
    name: string;
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

const dragging = ref(false);
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

async function onFeatureAdd(ev: SortableEvent): Promise<void> {
    const id = ev.item.id;
    if (!id) return;

    const cot = await mapStore.worker.db.get(id);
    if (!cot) throw new Error("Marker Not Found");

    let target = ev.target.id
    if (!target) throw new Error("Sorting Error");

    if (target === 'general') {
        const ps = paths.value.filter((p) => { return p.name === cot.path; });
        if (ps.length) {
            ps[0].cots.delete(cot);
        }

        cot.path = '/';
    } else {
        target = target.replace('folder-', '');
        const ps = paths.value.filter((p) => {
            return p.id === target;
        });

        if (ps.length !== 1) return;
        const p = ps[0];

        if (cot.path === '/') {
            cot.path = p.name;
            cots.value.delete(cot);
        } else {
            const ps = paths.value.filter((p) => { return p.name === cot.path; });
            if (ps.length !== 1) return;
            ps[0].cots.delete(cot);

            cot.path = p.name;
            p.cots.add(cot);
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

async function refresh(load = false): Promise<void> {
    if (load) loading.value = true;

    cots.value = new Set(Array.from(await mapStore.worker.db
        .filter(`
            properties.archived
            and path = "/"
            and $contains($lowercase(properties.callsign), "${query.value.filter.toLowerCase()}")
        `)))

    paths.value = (await mapStore.worker.db.paths())
        .map(p => p.path)
        .sort((a, b) => {
            if (a < b) {
                return -1;
            } else if (a > b) {
                return 1;
            } else {
              return 0;
            }
        }).filter((path) => {
            return path !== '/'
        }).map((path) => {
            return {
                id: crypto.randomUUID(),
                name: path,
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
            onStart: () => {
                dragging.value = true;
            },
            onEnd: () => {
                dragging.value = false;
            }
        })
    })
}

async function download(format: string): Promise<void> {
    window.location.href = String(stdurl(`/api/profile/feature?format=${format}&download=true&token=${localStorage.token}`));
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

    const folderDiv = document.getElementById(`folder-${path.id}`);
    if (!folderDiv) throw new Error('Could not load sortable');

    path.sortable = new Sortable(folderDiv, {
        sort: true,
        group: 'features',
        handle: '.drag-handle',
        dataIdAttr: 'id',
        onAdd: onFeatureAdd,
        onStart: () => {
            dragging.value = true;
        },
        onEnd: () => {
            dragging.value = false;
        }
    })
}

</script>
