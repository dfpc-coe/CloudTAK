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
            v-if='groups().length'
            class='ms-3'
        >
            <div class='align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.teams._'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.teams._ = true'
                />
                <IconChevronDown
                    v-else-if='treeState.teams._'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.teams._ = false'
                />
                <ContactPuck
                    class='mx-2'
                    :compact='true'
                    :contact='{ "team": "White" }'
                /> Teams
            </div>

            <template v-if='treeState.teams._'>
                <div
                    v-for='group in groups()'
                    class='ms-3'
                >
                    <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                        <IconChevronRight
                            v-if='!treeState.teams[group]'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState.teams[group] = true'
                        />
                        <IconChevronDown
                            v-else-if='treeState.teams[group]'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState.teams[group] = false'
                        />
                        <ContactPuck
                            class='mx-2'
                            :compact='true'
                            :contact='{ "team": group }'
                        /><span v-text='`${group} Team`' />
                    </div>

                    <template v-if='treeState.teams[group]'>
                        <div
                            v-for='contact in contacts(group)'
                            class='ms-3 d-flex align-items-center hover-button px-3 py-2 me-2'
                        >
                            <Contact
                                :compact='true'
                                :hover='false'
                                :button-zoom='true'
                                :button-chat='false'
                                :contact='{
                                    "uid": contact.id,
                                    "callsign": contact.properties.callsign,
                                    "team": contact.properties.group.name,
                                    "notes": ""
                                }'
                            />
                        </div>
                    </template>
                </div>
            </template>
        </div>

        <div
            v-if='markers().length'
            class='ms-3'
        >
            <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.markers._'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.markers._ = true'
                />
                <IconChevronDown
                    v-else-if='treeState.markers._'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.markers._ = false'
                />
                <IconMapPin
                    :size='20'
                    :stroke='2'
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

            <template v-if='treeState.markers._'>
                <div
                    v-for='marker in markers()'
                    class='ms-3'
                >
                    <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                        <IconChevronRight
                            v-if='!treeState.markers[marker]'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState.markers[marker] = true'
                        />
                        <IconChevronDown
                            v-else-if='treeState.markers[marker]'
                            :size='20'
                            stroke='1'
                            class='cursor-pointer'
                            @click='treeState.markers[marker] = false'
                        />
                        <IconFolder
                            class='mx-2'
                            :size='20'
                            :stroke='2'
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

                    <template v-if='treeState.markers[marker]'>
                        <div class='ms-3'>
                            <div class='ms-3'>
                                <Feature
                                    v-for='cot of markerFeatures(marker)'
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
            v-if='paths.length'
            class='ms-3'
        >
            <div class='d-flex align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.paths._'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.paths._ = true'
                />
                <IconChevronDown
                    v-else-if='treeState.paths._'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='treeState.paths._ = false'
                />
                <IconFolder
                    class='mx-2'
                    :size='20'
                    :stroke='2'
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

            <template v-if='treeState.paths._'>
                <div v-for='path in paths'>
                    <template v-if='path.path === "/"'>
                        <div class='ms-3'>
                            <Feature
                                v-for='cot of pathFeatures(path.path)'
                                :key='cot.id'
                                :feature='cot'
                            />
                        </div>
                    </template>
                    <template v-else>
                        <IconFolder
                            :size='20'
                            :stroke='2'
                            class='ms-3'
                        />
                        <span
                            class='mx-2'
                            v-text='path.path'
                        />
                        <div
                            v-if='props.element.id === "cots"'
                            class='ms-auto'
                        >
                            <TablerDelete
                                :size='20'
                                displaytype='icon'
                                @click='deletePath(props.element, path.path)'
                            />
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </template>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import {
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import Contact from '../../util/Contact.vue';
import Feature from '../../util/Feature.vue';
import ContactPuck from '../../util/ContactPuck.vue';
import { std, stdurl } from  '../../../../std.ts'
import DeleteModal from './DeleteModal.vue';
import {
    IconMapPin,
    IconTrash,
    IconChevronRight,
    IconChevronDown,
    IconFolder,
} from '@tabler/icons-vue';
import { useMapStore } from '../../../../stores/map.ts';
const mapStore = useMapStore();

const props = defineProps({
    element: Object
});

const loading = ref(false);
const deleteMarkerModal = ref({
    shown: false,
    marker: null
});
const paths = ref([]);
const treeState = ref({
    teams: {
        _: false
    },
    markers: {
        _: false
    },
    paths: {
        _: false
    }
});

onMounted(async () => {
    paths.value = await mapStore.worker.db.paths();
});

async function pathFeatures(path) {
    return await mapStore.worker.db.pathFeatures(path);
};

async function deleteMarkers(marker) {
    if (!deleteMarkerModal.value.shown) {
        deleteMarkerModal.value.shown = true;
        deleteMarkerModal.value.marker = marker;
        return;
    } else {
        deleteMarkerModal.value.shown = false;
    }

    loading.value = true;

    if (marker) {
        treeState.value.markers[marker] = false;
    }

    for (const feat of await mapStore.worker.db.markerFeatures(marker)) {
        await mapStore.worker.db.delete(feat.id);
    }

    loading.value = false;
}

async function deleteFeatures(path) {
    loading.value = true;

    if (path) {
        treeState.value.paths[path] = false;
    }

    for (const feat of await mapStore.worker.db.pathFeatures(path)) {
        await mapStore.worker.db.delete(feat.id);
    }

    if (path) {
        const url = stdurl('/api/profile/feature');
        url.searchParams.append('path', path);
        await std(url, {
            method: 'DELETE'
        });
    }

    loading.value = false;
}

async function markerFeatures(marker) {
    return mapStore.worker.db.markerFeatures(marker);
}

async function contacts(group) {
    const contacts = await mapStore.worker.db.contacts(group);
    return contacts;
}

async function deletePath(layer, path) {
    if (layer.id !== 'cots') return;

    loading.value = true;

    try {
        await mapStore.worker.db.deletePath(path);
    } catch (err) {
        loading.value = false;
        throw err;
    }

    loading.value = false;
}

async function markers() {
    const markers = await mapStore.worker.db.markers();

    for (const marker of markers) {
        if (treeState.value.markers[marker] === undefined) {
            treeState.value.markers[marker] = false;
        }
    }

    return markers;
}

async function groups() {
    const groups = await mapStore.worker.db.groups();

    for (const group of groups) {
        if (treeState.value.teams[group] === undefined) {
            treeState.value.teams[group] = false;
        }
    }

    return groups;
}
</script>
