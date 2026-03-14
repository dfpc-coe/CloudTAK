<template>
    <DeleteModal
        v-if='deleteMarkerModal.shown'
        :size='20'
        displaytype='icon'
        @close='deleteMarkerModal.shown = false'
        @click='deleteMarkers(deleteMarkerModal.marker)'
    />

    <TablerLoading v-if='loading' />
    <template v-else>
        <div
            v-if='Object.keys(groups).length'
            @click.stop
        >
            <div class='align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.groups._shown'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.groups._shown = true'
                />
                <IconChevronDown
                    v-else-if='treeState.groups._shown'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.groups._shown = false'
                />
                <ContactPuck
                    class='mx-2'
                    :size='20'
                    :team='"White"'
                /> Teams
            </div>

            <template v-if='treeState.groups._shown'>
                <div
                    v-for='group in Object.keys(groups)'
                    class='ms-3'
                >
                    <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                        <IconChevronRight
                            v-if='!treeState.groups.nodes[group]._shown'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState.groups.nodes[group]._loading = treeState.groups.nodes[group]._shown = true'
                        />
                        <IconChevronDown
                            v-else
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState.groups.nodes[group]._shown = false'
                        />

                        <ContactPuck
                            class='mx-2'
                            :size='20'
                            :team='group'
                        /><span v-text='`${group} Team`' />
                    </div>

                    <TablerLoading
                        v-if='treeState.groups.nodes[group]._loading'
                        :compact='true'
                    />
                    <template v-else-if='treeState.groups.nodes[group]._shown'>
                        <div
                            v-for='contact in groups[group].values()'
                            class='ms-3 d-flex align-items-center hover-button px-3 py-2 me-2'
                        >
                            <Contact
                                :compact='true'
                                :hover='false'
                                :button-chat='false'
                                :contact='makeContact(contact)'
                            />
                        </div>
                    </template>
                </div>
            </template>
        </div>

        <div
            v-if='Object.keys(markers).length'
            class='ms-3'
            @click.stop
        >
            <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.markers._shown'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.markers._shown = true'
                />
                <IconChevronDown
                    v-else-if='treeState.markers._shown'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.markers._shown = false'
                />
                <IconMapPin
                    :size='20'
                    stroke='2'
                    class='mx-2'
                /> Markers

                <div
                    class='ms-auto btn-list hover-button-hidden'
                >
                    <IconTrash
                        :size='20'
                        stroke='1'
                        class='cursor-pointer'
                        @click='deleteMarkers()'
                    />
                </div>
            </div>

            <template v-if='treeState.markers._shown'>
                <div
                    v-for='marker in Object.keys(markers)'
                    class='ms-3'
                >
                    <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                        <IconChevronRight
                            v-if='!treeState.markers.nodes[marker]._shown'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState.markers.nodes[marker]._loading = treeState.markers.nodes[marker]._shown = true'
                        />
                        <IconChevronDown
                            v-else
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState.markers.nodes[marker]._shown = false'
                        />
                        <IconFolder
                            class='mx-2'
                            :size='20'
                            stroke='2'
                        /> <span v-text='marker' />

                        <div class='ms-auto btn-list hover-button-hidden'>
                            <IconTrash
                                :size='20'
                                stroke='1'
                                class='cursor-pointer'
                                @click='deleteMarkers(marker)'
                            />
                        </div>
                    </div>

                    <TablerLoading
                        v-if='treeState.markers.nodes[marker]._loading'
                        :compact='true'
                    />
                    <template v-if='treeState.markers.nodes[marker]._shown'>
                        <div class='ms-3'>
                            <div class='ms-3'>
                                <Feature
                                    v-for='cot of markers[marker]'
                                    :key='cot.id'
                                    :feature='cot'
                                />
                            </div>
                        </div>
                    </template>
                </div>
            </template>
        </div>

        <div
            v-if='Object.keys(paths).length'
            class='ms-3'
            @click.stop
        >
            <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.paths._shown'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.paths._loading = treeState.paths._shown = true'
                />
                <IconChevronDown
                    v-else-if='treeState.paths._shown'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.paths._shown = false'
                />
                <IconFolder
                    class='mx-2'
                    :size='20'
                    stroke='2'
                /> Your Features

                <div class='ms-auto btn-list hover-button-hidden'>
                    <TablerDelete
                        :size='20'
                        class='cursor-pointer'
                        displaytype='icon'
                        @delete='deleteFeatures("/")'
                    />
                </div>
            </div>

            <template v-if='treeState.paths._shown'>
                <div
                    v-for='path in Object.keys(paths)'
                    class='ms-3'
                >
                    <template v-if='path === "/"'>
                        <TablerLoading
                            v-if='treeState.paths.nodes[path]._loading'
                            :compact='true'
                        />
                        <template v-else>
                            <Feature
                                v-for='cot of paths[path]'
                                :key='cot.id'
                                :feature='cot'
                            />
                        </template>
                    </template>
                    <template v-else>
                        <div class='d-flex align-items-center py-2 ps-2 ms-2 hover-button'>
                            <IconChevronRight
                                v-if='!treeState.paths.nodes[path]._shown'
                                :size='20'
                                stroke='1'
                                class='cursor-pointer'
                                @click='treeState.paths.nodes[path]._loading = treeState.paths.nodes[path]._shown = true'
                            />
                            <IconChevronDown
                                v-else-if='treeState.paths.nodes[path]._shown'
                                :size='20'
                                stroke='1'
                                class='cursor-pointer'
                                @click='treeState.paths.nodes[path]._shown = false'
                            />

                            <IconFolder
                                :size='20'
                                stroke='2'
                                class='mx-2'
                            />
                            <span
                                class='mx-2'
                                v-text='path.replace(/(^\/|\/$)/g, "")'
                            />
                            <div
                                v-if='element._internal'
                                class='ms-auto'
                            >
                                <TablerDelete
                                    :size='20'
                                    displaytype='icon'
                                    @click='deleteFeatures(path)'
                                />
                            </div>
                        </div>
                        <div class='ms-3'>
                            <TablerLoading
                                v-if='treeState.paths.nodes[path]._loading'
                                :compact='true'
                            />
                            <template v-else>
                                <Feature
                                    v-for='cot of paths[path]'
                                    :key='cot.id'
                                    :feature='cot'
                                />
                            </template>
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </template>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import {
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import Contact from '../../util/Contact.vue';
import Feature from '../../util/FeatureRow.vue';
import ContactPuck from '../../util/ContactPuck.vue';
import DeleteModal from './DeleteModal.vue';
import {
    IconMapPin,
    IconTrash,
    IconChevronRight,
    IconChevronDown,
    IconFolder,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../../stores/map.ts';
import type Overlay from '../../../../base/overlay.ts';
import type COT from '../../../../base/cot.ts';
import type { Contact as ContactData } from '../../../../types.ts';

const mapStore = useMapStore();

defineProps<{
    element: Overlay;
}>();

interface TreeNodeState {
    _shown: boolean;
    _loading: boolean;
}

interface TreeBranchState extends TreeNodeState {
    nodes: Record<string, TreeNodeState>;
}

interface TreeState {
    groups: TreeBranchState;
    markers: TreeBranchState;
    paths: TreeBranchState;
}

const loading = ref<boolean>(true);
const deleteMarkerModal = ref<{ shown: boolean; marker: string | null }>({
    shown: false,
    marker: null,
});

const markers = ref<Record<string, Set<COT>>>({});
const groups = ref<Record<string, Set<COT>>>({});
const paths = ref<Record<string, Set<COT>>>({});

function makeContact(cot: COT): ContactData {
    const p = cot.properties ?? {};
    return {
        uid: cot.id,
        callsign: String(p['callsign'] ?? ''),
        team: String((p['group'] as { name?: string } | undefined)?.name ?? ''),
        role: String(p['role'] ?? ''),
        takv: String(p['takv'] ?? ''),
        notes: String(p['notes'] ?? ''),
        filterGroups: p['filterGroups'] ?? null,
    };
}

const rebuilding = ref<boolean>(false);
const treeState = ref<TreeState>({
    groups: {
        _shown: false,
        _loading: false,
        nodes: {},
    },
    markers: {
        _shown: false,
        _loading: false,
        nodes: {},
    },
    paths: {
        _shown: false,
        _loading: false,
        nodes: {},
    },
});

onMounted(async () => {
    loading.value = true;
    await refresh();
    loading.value = false;
});

watch(treeState.value, async () => {
    if (rebuilding.value) return;
    await refresh();
});

async function refresh(): Promise<void> {
    rebuilding.value = true;

    const remotePaths = (await mapStore.worker.db.paths()).map((p) => p.path).sort((a) => {
        return a === '/' ? 1 : -1;
    });
    const remoteGroups = await mapStore.worker.db.groups();
    const remoteMarkers = await mapStore.worker.db.markers();

    for (const marker of Object.keys(treeState.value.markers.nodes)) {
        if (!remoteMarkers.includes(marker)) {
            delete treeState.value.markers.nodes[marker];
            delete markers.value[marker];
        }
    }

    for (const marker of remoteMarkers) {
        markers.value[marker] = new Set<COT>();

        if (treeState.value.markers.nodes[marker] === undefined) {
            treeState.value.markers.nodes[marker] = { _shown: false, _loading: false };
        }

        if (treeState.value.markers.nodes[marker]._shown) {
            markers.value[marker] = await mapStore.worker.db.markerFeatures(marker);
        }

        treeState.value.markers.nodes[marker]._loading = false;
    }

    for (const path of Object.keys(treeState.value.paths.nodes)) {
        if (!remotePaths.includes(path)) {
            delete treeState.value.paths.nodes[path];
            delete paths.value[path];
        }
    }

    for (const path of remotePaths) {
        paths.value[path] = new Set<COT>();

        if (treeState.value.paths.nodes[path] === undefined) {
            treeState.value.paths.nodes[path] = { _shown: false, _loading: false };
        }
    }

    if (treeState.value.paths._shown && !treeState.value.paths.nodes['/']._shown) {
        treeState.value.paths.nodes['/']._loading = true;
        treeState.value.paths.nodes['/']._shown = true;
    }

    for (const path of remotePaths) {
        if (treeState.value.paths.nodes[path]._shown) {
            paths.value[path] = await mapStore.worker.db.pathFeatures(path);
        }

        treeState.value.paths.nodes[path]._loading = false;
    }

    for (const group of remoteGroups) {
        groups.value[group] = new Set<COT>();

        if (treeState.value.groups.nodes[group] === undefined) {
            treeState.value.groups.nodes[group] = { _shown: false, _loading: false };
        }

        if (treeState.value.groups.nodes[group]._shown) {
            groups.value[group] = await mapStore.worker.db.contacts(group);
        }

        treeState.value.groups.nodes[group]._loading = false;
    }

    rebuilding.value = false;
}

async function deleteMarkers(marker?: string | null): Promise<void> {
    if (!deleteMarkerModal.value.shown) {
        deleteMarkerModal.value.shown = true;
        deleteMarkerModal.value.marker = marker ?? null;
        return;
    } else {
        deleteMarkerModal.value.shown = false;
    }

    loading.value = true;

    if (marker) {
        treeState.value.markers.nodes[marker]._loading = true;
        await mapStore.worker.db.filterDelete(`
            ($exists(properties.archived) = false or ($exists(properties.archived) and properties.archived = false)) and properties.type = '${marker}'
        `);
        treeState.value.markers.nodes[marker]._loading = false;
    } else {
        treeState.value.markers._loading = true;
        await mapStore.worker.db.filterDelete(`
            ($exists(properties.archived) = false or ($exists(properties.archived) and properties.archived = false))
        `);
        treeState.value.markers._loading = false;
    }

    await refresh();
    loading.value = false;
}

async function deleteFeatures(path: string): Promise<void> {
    loading.value = true;

    if (path) {
        treeState.value.paths.nodes[path]._loading = true;

        await mapStore.worker.db.filterDelete(`
            $exists(properties.archived)
            and $exists(path)
            and properties.archived = true
            and path = '${path}'
        `);

        treeState.value.paths.nodes[path]._loading = false;
    } else {
        treeState.value.paths._loading = true;

        await mapStore.worker.db.filterDelete(`
            $exists(properties.archived)
            and $exists(path)
            and properties.archived = true
        `);

        treeState.value.paths._loading = false;
    }

    await refresh();
    loading.value = false;
}
</script>
