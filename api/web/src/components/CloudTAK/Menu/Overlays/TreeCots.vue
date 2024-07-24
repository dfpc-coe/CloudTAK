<template>
    <TablerLoading v-if='loadingPaths[element.id] === true' />
    <template v-else>
        <div
            v-if='groups().length'
            class='ms-3'
        >
            <div class='align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.teams._'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState.teams._ = true'
                />
                <IconChevronDown
                    v-else-if='treeState.teams._'
                    :size='20'
                    :stroke='1'
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
                            :stroke='1'
                            class='cursor-pointer'
                            @click='treeState.teams[group] = true'
                        />
                        <IconChevronDown
                            v-else-if='treeState.teams[group]'
                            :size='20'
                            :stroke='1'
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

        <div class='ms-3'>
            <div class='align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.markers._'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState.markers._ = true'
                />
                <IconChevronDown
                    v-else-if='treeState.markers._'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState.markers._ = false'
                />
                <IconMapPin
                    :size='20'
                    :stroke='2'
                    class='mx-2'
                /> Markers
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
                            :stroke='1'
                            class='cursor-pointer'
                            @click='treeState.teams[group] = true'
                        />
                        <IconChevronDown
                            v-else-if='treeState.teams[group]'
                            :size='20'
                            :stroke='1'
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
            v-if='paths.length'
            class='ms-3'
        >
            <div class='align-items-center px-3 py-2 me-2 hover-button'>
                <IconChevronRight
                    v-if='!treeState.paths._'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState.paths._ = true'
                />
                <IconChevronDown
                    v-else-if='treeState.paths._'
                    :size='20'
                    :stroke='1'
                    class='cursor-pointer'
                    @click='treeState.paths._ = false'
                />
                <IconFolder
                    class='mx-2'
                    :size='20'
                    :stroke='2'
                /> Your Features
            </div>

            <template v-if='treeState.paths._'>
                <div
                    v-for='path in paths'
                    class='d-flex align-items-center hover-button px-3 py-2'
                >
                    <template v-if='path.path === "/"'>
                        <div v-for='cot of pathFeatures(path.path)'>
                            <span v-text='cot.properties.callsign' />
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
                            v-if='element.id === "cots"'
                            class='ms-auto'
                        >
                            <TablerDelete
                                :size='20'
                                displaytype='icon'
                                @click='deletePath(element, path.path)'
                            />
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </template>
</template>

<script>
import {
    TablerDelete,
    TablerLoading,
} from '@tak-ps/vue-tabler';
import Contact from '../../util/Contact.vue';
import ContactPuck from '../../util/ContactPuck.vue';
import {
    IconMapPin,
    IconChevronRight,
    IconChevronDown,
    IconFolder,
} from '@tabler/icons-vue';
import { useCOTStore } from '/src/stores/cots.ts';
const cotStore = useCOTStore();

export default {
    name: 'TreeCots',
    components: {
        ContactPuck,
        Contact,
        TablerLoading,
        TablerDelete,
        IconMapPin,
        IconChevronRight,
        IconChevronDown,
        IconFolder,
    },
    props: {
        element: Object
    },
    data: function() {
        return {
            loading: false,
            treeState: {
                teams: {
                    _: false
                },
                markers: {
                    _: false
                },
                paths: {
                    _: false
                }
            },
            loadingPaths: {}
        }
    },
    computed: {
        paths: function() {
            return cotStore.paths();
        },
    },
    methods: {
        pathFeatures: function(path) {
            return cotStore.pathFeatures(cotStore.cots, path);
        },
        contacts: function(group) {
            const contacts = cotStore.contacts(cotStore.cots, group);
            return contacts;
        },
        deletePath: async function(layer, path) {
            if (layer.id !== 'cots') return;

            this.loadingPaths[layer.id] = true;

            try {
                await cotStore.deletePath(path);
            } catch (err) {
                this.loadingPaths[layer.id] = false;
                throw err;
            }

            this.loadingPaths[layer.id] = false;
        },
        groups: function() {
            const groups = cotStore.groups();

            for (const group of groups) {
                if (this.treeState.teams[group] === undefined) {
                    this.treeState.teams[group] = false;
                }
            }

            return groups;
        },
    },
}
</script>
