<template>
    <MenuTemplate
        name='Mission Layers'
        :back='false'
        :border='false'
    >
        <template #buttons>
            <TablerIconButton
                v-if='!createLayer && role.permissions.includes("MISSION_WRITE")'
                title='New Mission Layer'
                :size='24'
                @click='createLayer = true'
            >
                <IconPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                title='Refresh Mission Layers'
                :size='24'
                @click='refresh'
            >
                <IconRefresh
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
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
                v-else-if='!layers.length && !orphaned.size'
                :create='false'
                :compact='true'
                label='Layers'
            />
            <template v-else>
                <Feature
                    v-for='uid of Array.from(orphaned)'
                    :key='uid'
                    :delete-button='false'
                    :feature='feats.get(uid)'
                    :mission='mission'
                />
                <MissionLayer
                    :layers='layers'
                    :feats='feats'
                    :mission='mission'
                    :role='role'
                    :token='token'
                />
            </template>
        </div>
    </MenuTemplate>
</template>

<script>
import { std, stdurl } from '/src/std.ts';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import Feature from '../../util/Feature.vue';
import MenuTemplate from '../../util/MenuTemplate.vue';
import MissionLayer from './MissionLayer.vue';
import MissionLayerCreate from './MissionLayerCreate.vue';

export default {
    name: 'MissionLayers',
    components: {
        IconPlus,
        IconRefresh,
        Feature,
        MenuTemplate,
        MissionLayer,
        MissionLayerCreate,
        TablerNone,
        TablerLoading,
        TablerIconButton,
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
            orphaned: new Set(),
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
                this.orphaned.add(feat.id);
            }
        },
        removeFeatures: async function(layers) {
            for (const layer of layers) {
                if (layer.type === 'UID' && layer.uids && layer.uids.length) {
                    for (const cot of layer.uids) {
                        this.orphaned.delete(cot.data);
                    }
                }

                if (layer.mission_layers) {
                    this.removeFeatures(layer.mission_layers);
                }
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

            this.removeFeatures(this.layers);
        },
    }
}
</script>
