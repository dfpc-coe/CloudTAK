<template>
    <MenuTemplate
        name='Mission Layers'
        :back='false'
        :border='false'
    >
        <template #buttons>
            <IconPlus
                v-if='!createLayer && role.permissions.includes("MISSION_WRITE")'
                :size='24'
                :stroke='1'
                class='cursor-pointer'
                @click='createLayer = true'
            />
            <IconRefresh
                :size='24'
                :stroke='1'
                class='cursor-pointer'
                @click='refresh'
            />
        </template>

        <div class='col-12'>
            <MissionLayerCreate
                v-if='createLayer'
                class='px-2'
                :mission='mission'
                @layer='refresh'
                @cancel='createLayer = false'
            />
            <TablerLoading
                v-else-if='loading.layers'
                class='mx-2'
                desc='Loading Layers...'
            />
            <TablerNone
                v-else-if='!layers.length && !feats.size'
                :create='false'
                :compact='true'
                label='Layers'
            />
            <template v-else>
                <Feature
                    v-for='feat of feats.values()'
                    :deleteButton='false'
                    :key='feat.id'
                    :feature='feat'
                    :mission='mission'
                />
                <div
                    v-for='layer in layers'
                    :key='layer.uid'
                >
                    <div class='col-12 hover-dark d-flex align-items-center px-2 py-2'>
                        <IconChevronRight
                            v-if='layer.type === "UID" && !layer._open'
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            @click='layer._open = true'
                        />
                        <IconChevronDown
                            v-else-if='layer.type === "UID" && layer._open'
                            :size='32'
                            :stroke='1'
                            class='cursor-pointer'
                            @click='layer._open = false'
                        />

                        <IconFiles
                            v-if='layer.type === "CONTENTS"'
                            :size='32'
                            :stroke='1'
                        />
                        <IconMapPins
                            v-else-if='layer.type === "UID"'
                            :size='32'
                            :stroke='1'
                        />
                        <IconFolder
                            v-else-if='layer.type === "GROUP"'
                            :size='32'
                            :stroke='1'
                        />
                        <IconMap
                            v-else-if='layer.type === "MAPLAYER"'
                            :size='32'
                            :stroke='1'
                        />
                        <IconPin
                            v-else-if='layer.type === "ITEM"'
                            :size='32'
                            :stroke='1'
                        />

                        <span
                            class='mx-2'
                            v-text='layer.name'
                        />

                        <div class='ms-auto btn-list d-flex align-items-center'>
                            <span
                                v-if='layer.type === "UID"'
                                class='mx-3 ms-auto badge border bg-blue text-white'
                                v-text='`${layer.uids.length} Features`'
                            />

                            <IconPencil
                                v-if='role.permissions.includes("MISSION_WRITE")'
                                :size='24'
                                :stroke='1'
                                class='cursor-pointer'
                                @click='layer._edit = true'
                            />

                            <TablerDelete
                                v-if='role.permissions.includes("MISSION_WRITE")'
                                displaytype='icon'
                                :size='24'
                                :stroke='1'
                                @delete='deleteLayer(layer)'
                            />
                        </div>
                    </div>

                    <MissionLayerEdit
                        v-if='layer._edit'
                        :mission='mission'
                        :layer='layer'
                        :role='role'
                        @cancel='layer._edit = false'
                        @layer='refresh'
                    />
                    <div
                        v-else-if='layer._open && layer.type === "UID"'
                    >
                        <div
                            v-for='cot of layer.uids'
                            :key='cot.data'
                            class='hover-dark py-2'
                            style='padding-left: 24px'
                        >
                            <IconMapPin
                                :size='32'
                                :stroke='1'
                            />

                            <span
                                class='mx-2'
                                v-text='cot.details.callsign || "UNKNOWN"'
                            />
                        </div>
                    </div>
                </div>
            </template>
        </div>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconChevronRight,
    IconChevronDown,
    IconPlus,
    IconPencil,
    IconRefresh,
    IconFiles,
    IconMapPin,
    IconMapPins,
    IconFolder,
    IconMap,
    IconPin,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import Feature from '../../util/Feature.vue';
import MenuTemplate from '../../util/MenuTemplate.vue';
import MissionLayerCreate from './MissionLayerCreate.vue';
import MissionLayerEdit from './MissionLayerEdit.vue';

export default {
    name: 'MissionLayers',
    components: {
        Feature,
        IconChevronRight,
        IconChevronDown,
        IconFiles,
        IconPencil,
        IconMapPin,
        IconMapPins,
        IconFolder,
        IconMap,
        IconPin,
        IconPlus,
        IconRefresh,
        TablerDelete,
        MenuTemplate,
        MissionLayerEdit,
        MissionLayerCreate,
        TablerNone,
        TablerLoading
    },
    props: {
        mission: Object,
        token: String,
        role: Object,
    },
    data: function() {
        return {
            createLayer: false,
            loading: {
                layers: true,
            },
            feats: new Map(),
            layers: [],
        }
    },
    mounted: async function() {
        await this.refresh();
    },
    methods: {
        refresh: async function() {
            this.createLayer = false;
            this.loading.layers = true;
            await this.fetchFeats();
            await this.fetchLayers();

            this.loading.layers = false;
        },
        deleteLayer: async function(layer) {
            this.loading.layers = true;
            const url = stdurl(`/api/marti/missions/${this.mission.name}/layer/${layer.uid}`);

            await std(url, {
                method: 'DELETE',
                headers: {
                    MissionAuthorization: this.token
                },
            })

            await this.refresh();
        },
        fetchFeats: async function() {
            const url = stdurl(`/api/marti/missions/${this.mission.name}/cot`);
            const fc = await std(url, {
                headers: {
                    MissionAuthorization: this.token
                },
            });

            for (const feat of fc.features) {
                this.feats.set(feat.id, feat);
            }
        },
        fetchLayers: async function() {
            const url = stdurl(`/api/marti/missions/${this.mission.name}/layer`);
            this.layers = (await std(url, {
                headers: {
                    MissionAuthorization: this.token
                },
            })).data.map((l) => {
                l._edit = false;
                l._open = false;
                return l;
            });

            for (const layer of this.layers) {
                if (layer.type === "UID" && layer.uids.length) {
                    for (const cot of layer.uids) {
                        this.feats.delete(cot.data);
                    }
                }
            }
        },
    }
}
</script>
