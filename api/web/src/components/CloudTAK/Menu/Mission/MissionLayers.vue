<template>
    <MenuTemplate
        name='Mission Layers'
        :back='false'
        :border='false'
    >
        <template #buttons>
            <IconPlus
                v-if='!createLayer && role.permissions.includes("MISSION_WRITE")'
                size='24'
                class='cursor-pointer'
                @click='createLayer = true'
            />
            <IconRefresh
                size='24'
                class='cursor-pointer'
                @click='fetchLayers'
            />
        </template>

        <div class='col-12'>
            <MissionLayerCreate
                v-if='createLayer'
                class='px-2'
                :mission='mission'
                @layer='fetchLayers'
                @cancel='createLayer = false'
            />
            <TablerLoading
                v-else-if='loading.layers'
                class='mx-2'
                desc='Loading Layers...'
            />
            <TablerNone
                v-else-if='!layers.length'
                :create='false'
                :compact='true'
                label='Layers'
            />
            <template v-else>
                <div
                    v-for='layer in layers'
                    class='col-12 hover-dark d-flex align-items-center px-2 py-2'
                >
                    <IconFiles
                        v-if='layer.type === "CONTENTS"'
                        size='32'
                    />
                    <IconMapPin
                        v-else-if='layer.type === "UID"'
                        size='32'
                    />
                    <IconFolder
                        v-else-if='layer.type === "GROUP"'
                        size='32'
                    />
                    <IconMap
                        v-else-if='layer.type === "MAPLAYER"'
                        size='32'
                    />
                    <IconPin
                        v-else-if='layer.type === "ITEM"'
                        size='32'
                    />

                    <span v-text='layer.name' class='mx-2'/>

                    <div class='ms-auto btn-list'>
                        <span
                            v-if='layer.type === "UID"'
                            class='mx-3 ms-auto badge border bg-blue text-white'
                            v-text='`${layer.uids.length} Features`'
                        />

                        <TablerDelete
                            v-if='role.permissions.includes("MISSION_WRITE")'
                            displaytype='icon'
                            size='24'
                            @delete='deleteLayer(layer)'
                        />
                    </div>
                </div>
            </template>
        </div>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconPlus,
    IconRefresh,
    IconFiles,
    IconMapPin,
    IconFolder,
    IconMap,
    IconPin,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerDelete,
    TablerLoading
} from '@tak-ps/vue-tabler';
import MenuTemplate from '../../util/MenuTemplate.vue';
import MissionLayerCreate from './MissionLayerCreate.vue';

export default {
    name: 'MissionInfo',
    components: {
        IconFiles,
        IconMapPin,
        IconFolder,
        IconMap,
        IconPin,
        IconPlus,
        IconRefresh,
        TablerDelete,
        MenuTemplate,
        MissionLayerCreate,
        TablerNone,
        TablerLoading
    },
    props: {
        mission: Object,
        role: Object,
    },
    data: function() {
        return {
            createLayer: false,
            loading: {
                layers: true,
            },
            layers: [],
        }
    },
    mounted: async function() {
        await this.fetchLayers();
    },
    methods: {
        deleteLayer: async function(layer) {
            this.loading.layers = true;
            const url = stdurl(`/api/marti/missions/${this.mission.name}/layer/${layer.uid}`);

            await std(url, { method: 'DELETE' })

            await this.fetchLayers();
        },
        fetchLayers: async function() {
            this.createLayer = false;
            this.loading.layers = true;
            const url = stdurl(`/api/marti/missions/${this.mission.name}/layer`);
            this.layers = (await std(url)).data;
            this.loading.layers = false;
        },
    }
}
</script>
