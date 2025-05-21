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
                        class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2 py-2'
                        @click.stop.prevent='download("geojson")'
                    >
                        <IconFile
                            :size='32'
                            stroke='1'
                        />
                        <span class='mx-2'>GeoJSON</span>
                    </div>
                    <div
                        class='cursor-pointer col-12 hover-dark d-flex align-items-center px-2 py-2'
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
                v-else-if='cots.length === 0'
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
                        @dragleave='dragLeaveFolder(path)'
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
                    </div>
                    <div
                        v-if='path.opened'
                        class='ms-2'
                    >
                        <TablerLoading v-if='path.loading' />
                        <template v-else>
                            <div class='folder'>
                                <Feature
                                    v-for='cot of path.cots.values()'
                                    :key='cot.id'
                                    :grip-handle='true'
                                    :delete-button='true'
                                    :info-button='true'
                                    :feature='cot'
                                />
                            </div>
                        </template>
                    </div>
                </template>

                <div ref='sortableFilesRef'>
                    <Feature
                        v-for='cot of cots'
                        :key='cot.id'
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
import { ref, watch, onMounted, onBeforeUnmount, useTemplateRef } from 'vue';
import { stdurl } from '../../../std.ts';
import COT from '../../../base/cot.ts';
import MenuTemplate from '../util/MenuTemplate.vue';
import Feature from '../util/Feature.vue';
import {
    TablerNone,
    TablerInput,
    TablerLoading,
    TablerDropdown,
    TablerIconButton,
    TablerRefreshButton
} from '@tak-ps/vue-tabler';
import type { WorkerMessage } from '../../../base/events.ts';
import { WorkerMessageType } from '../../../base/events.ts';
import {
    IconFile,
    IconFolder,
    IconDownload,
    IconChevronRight,
    IconChevronDown
} from '@tabler/icons-vue';
import Sortable from 'sortablejs';
import type { SortableEvent } from 'sortablejs'
import { useMapStore } from '../../../stores/map.ts';

const mapStore = useMapStore();

type Path = {
    name: string;
    opened: boolean;
    loading: boolean;
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

const cots = ref<COT[]>([]);
const paths = ref<Array<Path>>();
const query = ref({
    filter: ''
})

let sortableFiles: Sortable;

const dragging = ref(false);
const loading = ref(true);

const hover = ref<Path | undefined>();
const hoverTimer = ref<ReturnType<setTimeout> | undefined>();

watch(query.value, async () => {
    await refresh();
})

onMounted(async () => {
    await refresh();

    sortableFiles = new Sortable(sortableFilesRef.value, {
        sort: true,
        handle: '.drag-handle',
        dataIdAttr: 'id',
        onStart: () => {
            dragging.value = true;
        },
        onEnd: () => {
            dragging.value = false;
        }
    })

    for (const folder of document.querySelectorAll('.folder')) {
        console.error(folder);

        sortableFolders = new Sortable(sortableFoldersRef.value, {
            sort: true,
            handle: '.drag-handle',
            dataIdAttr: 'id',
            onStart: () => {
                dragging.value = true;
            },
            onEnd: () => {
                dragging.value = false;
            }
        })
    }
});

onBeforeUnmount(() => {
    if (channel) {
        channel.close();
    }

    sortableFiles.destroy();
})

async function dragOverFolder(path: Path) {
    if (!dragging.value || path.opened) return;

    if (!path.opened) {
        hover.value = path;
        hoverTimer.value = setTimeout(async () => {
            await openPath(path);
        }, 1000);
    }
}

async function dragLeaveFolder() {
    hover.value = undefined;

    if (hoverTimer.value) {
        clearTimeout(hoverTimer.value);
        hoverTimer.value = undefined;
    }
}

async function refresh(load = false): Promise<void> {
    if (load) loading.value = true;

    cots.value = Array.from(await mapStore.worker.db
        .filter(`
            properties.archived
            and $contains($lowercase(properties.callsign), "${query.value.filter.toLowerCase()}")
        `))

    paths.value = (await mapStore.worker.db.paths())
        .map(p => p.path)
        .sort((a) => {
            return a === '/' ? 1 : -1;
        }).filter((path) => {
            return path !== '/'
        }).map((path) => {
            return {
                name: path,
                opened: false,
                loading: false,
                cots: new Set()
            }
        });

    loading.value = false
}

async function download(format: string) {
    window.location.href = String(stdurl(`/api/profile/feature?format=${format}&download=true&token=${localStorage.token}`));
}

async function closePath(path: Path): Promise<void> {
    path.opened = false;
}

async function openPath(path: Path): Promise<void> {
    path.opened = true;
    path.loading = true;
    path.cots = await mapStore.worker.db.pathFeatures(path.name);
    path.loading = false;
}

</script>
