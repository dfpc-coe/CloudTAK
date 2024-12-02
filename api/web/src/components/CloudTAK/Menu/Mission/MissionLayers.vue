<template>
    <MenuTemplate
        name='Mission Layers'
        :back='false'
        :border='false'
    >
        <template #buttons>
            <TablerIconButton
                v-if='!createLayer && role && role.permissions.includes("MISSION_WRITE")'
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
                v-else-if='loading'
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
                <MissionLayerTree
                    :layers='layers'
                    :feats='feats'
                    :mission='mission'
                    :role='role'
                    :token='token'
                    @refresh='refresh'
                />
            </template>
        </div>
    </MenuTemplate>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import {
    IconPlus,
    IconRefresh,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import type {
    Mission,
    MissionRole,
    MissionLayer
} from '../../../../../src/types.ts';
import Subscription from '../../../../../src/stores/base/mission.ts';
import Feature from '../../util/Feature.vue';
import MenuTemplate from '../../util/MenuTemplate.vue';
import MissionLayerTree from './MissionLayerTree.vue';
import MissionLayerCreate from './MissionLayerCreate.vue';

const props = defineProps<{
    mission: Mission,
    token?: string,
    role?: MissionRole
}>()

const createLayer = ref(false)
const loading = ref(true);
const feats = ref(new Map());
const orphaned = ref<Set<string>>(new Set());
const layers = ref<Array<MissionLayer>>([]);

onMounted(async () => {
    await refresh();
});

async function refresh() {
    createLayer.value = false;
    loading.value = true;
    await fetchFeats();
    await fetchLayers();

    loading.value = false;
}

async function fetchFeats() {
    const fc = await Subscription.featList(props.mission.guid, props.token)

    for (const feat of fc.features) {
        feats.value.set(feat.id, feat);
        orphaned.value.add(String(feat.id));
    }
}

async function removeFeatures() {
    for (const layer of layers.value.mission_layers) {
        if (layer.type === 'UID' && layer.uids && layer.uids.length) {
            for (const cot of layer.uids) {
                orphaned.value.delete(cot.data);
            }
        }

        if (layer.mission_layers) {
            removeFeatures(layer.mission_layers);
        }
    }
}

async function fetchLayers() {
    layers.value = (await Subscription.layerList(props.mission.guid, props.token)).data;
    removeFeatures();
}
</script>
