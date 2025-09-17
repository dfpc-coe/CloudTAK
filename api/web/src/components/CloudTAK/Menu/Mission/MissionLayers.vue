<template>
    <MenuTemplate
        v-if='menu'
        name='Mission Layers'
        :zindex='0'
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
                <IconFolderPlus
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerRefreshButton
                :loading='loading'
                @click='refresh'
            />
        </template>

        <div
            v-if='createLayer'
            class='col-12 px-2 pb-4'
        >
            <MissionLayerCreate
                :mission='props.mission'
                :token='props.token'
                @layer='refresh'
                @cancel='createLayer = false'
            />
        </div>

        <div class='col-12'>
            <TablerLoading
                v-if='loading'
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
                <MissionLayerTree
                    :orphaned='orphaned'
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
    <template v-else>
        <TablerLoading
            v-if='loading'
            class='mx-2'
            desc='Loading Layers...'
        />
        <TablerNone
            v-else-if='!layers.length && !orphaned.size'
            :create='false'
            :compact='true'
            label='Layers'
        />
        <MissionLayerTree
            v-else
            :orphaned='orphaned'
            :layers='layers'
            :feats='feats'
            :mission='mission'
            :role='role'
            :token='token'
            @refresh='refresh'
        />
    </template>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import {
    IconFolderPlus,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import type {
    Mission,
    MissionRole,
    MissionLayer
} from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import MenuTemplate from '../../util/MenuTemplate.vue';
import MissionLayerTree from './MissionLayerTree.vue';
import MissionLayerCreate from './MissionLayerCreate.vue';

const props = defineProps<{
    menu: boolean,
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
    const fc = await Subscription.featList(props.mission.name, {
        missionToken: props.token
    })

    for (const feat of fc.features) {
        feats.value.set(feat.id, feat);
        orphaned.value.add(String(feat.id));
    }
}

function removeFeatures(mlayers: MissionLayer[]): void {
    for (const layer of mlayers) {
        if (layer.type === 'UID' && layer.uids && layer.uids.length) {
            for (const cot of layer.uids) {
                orphaned.value.delete(cot.data);
            }
        }

        if (layer.mission_layers) {
            // @ts-expect-error Due to recursive type limits this is unknown
            removeFeatures(layer.mission_layers);
        }
    }
}

async function fetchLayers(): Promise<void> {
    layers.value = (await Subscription.layerList(props.mission.name, {
        missionToken: props.token
    })).data;

    if (layers.value) {
        removeFeatures(layers.value);
    }
}
</script>
