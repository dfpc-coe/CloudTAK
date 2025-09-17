<template>
    <TablerLoading v-if='loading' />
    <template v-else>
        <template
            v-for='layer in layers'
            :key='layer.uid'
        >
            <div class='col-12 hover d-flex align-items-center px-3 py-2'>
                <IconChevronRight
                    v-if='layer.type === "GROUP" && !opened.has(layer.uid)'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='opened.add(layer.uid)'
                />
                <IconChevronDown
                    v-else-if='layer.type === "GROUP" && opened.has(layer.uid)'
                    :size='20'
                    stroke='1'
                    class='cursor-pointer'
                    @click='opened.delete(layer.uid)'
                />

                <IconFiles
                    v-if='layer.type === "CONTENTS"'
                    :size='20'
                    stroke='1'
                />
                <IconMapPins
                    v-else-if='layer.type === "UID"'
                    :size='20'
                    stroke='1'
                />
                <IconFolder
                    v-else-if='layer.type === "GROUP"'
                    :size='20'
                    stroke='1'
                />
                <IconMap
                    v-else-if='layer.type === "MAPLAYER"'
                    :size='20'
                    stroke='1'
                />
                <IconPin
                    v-else-if='layer.type === "ITEM"'
                    :size='20'
                    stroke='1'
                />

                <span
                    class='mx-2'
                    v-text='layer.name'
                />

                <div class='ms-auto btn-list d-flex align-items-center'>
                    <span
                        v-if='layer.type === "UID"'
                        class='mx-3 ms-auto badge border text-white'
                        :class='{
                            "bg-blue": layer.uids && layer.uids.length > 0,
                            "bg-gray": !layer.uids || layer.uids.length === 0
                        }'
                        v-text='`${layer.uids ? layer.uids.length : 0} Features`'
                    />

                    <TablerIconButton
                        v-if='role && role.permissions.includes("MISSION_WRITE")'
                        title='Edit Name'
                        :size='24'
                        @click='edit.add(layer.uid)'
                    >
                        <IconPencil stroke='1' />
                    </TablerIconButton>

                    <TablerDelete
                        v-if='role && role.permissions.includes("MISSION_WRITE")'
                        displaytype='icon'
                        :size='24'
                        @delete='deleteLayer(layer)'
                    />
                </div>
            </div>

            <MissionLayerEdit
                v-if='edit.has(layer.uid)'
                :mission='props.mission'
                :token='props.token'
                :layer='layer'
                :role='role'
                @cancel='edit.delete(layer.uid)'
                @layer='emit("refresh")'
            />

            <div
                v-else-if='opened.has(layer.uid) && layer.type === "UID"'
                class='mx-2'
            >
                <SingleFeature
                    v-for='cot of cots(layer)'
                    :key='cot.id'
                    :delete-button='false'
                    :feature='cot'
                    :mission='mission'
                />
                <MissionLayerTree
                    v-if='layer.mission_layers && layer.mission_layers.length'
                    :layers='layer.mission_layers as Array<MissionLayer>'
                    :feats='feats'
                    :mission='mission'
                    :token='token'
                    :role='role'
                    @refresh='emit("refresh")'
                />
                <TablerNone
                    v-if='!layer.uids || !layer.uids.length'
                    :create='false'
                    :compact='true'
                    class='py-2'
                />
            </div>
        </template>

        <SingleFeature
            v-for='feat of orphanedFeats'
            :key='feat.id'
            :delete-button='false'
            :feature='feat'
            :mission='mission'
        />
    </template>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import type { Mission, MissionLayer, MissionRole, Feature } from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import MissionLayerTree from './MissionLayerTree.vue';
import {
    IconChevronRight,
    IconChevronDown,
    IconFiles,
    IconMapPins,
    IconFolder,
    IconPencil,
    IconMap,
    IconPin,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import SingleFeature from '../../util/FeatureRow.vue';
import MissionLayerEdit from './MissionLayerEdit.vue';

const emit = defineEmits([
    'refresh'
])

const props = defineProps<{
    layers: Array<MissionLayer>,
    feats: Map<string, Feature>,
    mission: Mission,
    orphaned?: Set<string>,
    token?: string,
    role?: MissionRole
}>();

const opened = ref<Set<string>>(new Set());
const edit = ref<Set<string>>(new Set());
const loading = ref(false);

const orphanedFeats = computed<Feature[]>(() => {
    const feats = [];
    for (const uid of props.orphaned || []) {
        const feat = props.feats.get(uid);
        if (feat) feats.push(feat);
    }

    return feats;
})

function cots(layer: MissionLayer): Array<Feature> {
    const cots = [];
    for (const cot of (layer.uids || [])) {
        const feat = props.feats.get(cot.data)
        if (feat) cots.push(feat);
    }
    return cots;
}

async function deleteLayer(layer: MissionLayer) {
    loading.value = true;

    await Subscription.layerDelete(props.mission.guid, layer.uid, {
        missionToken: props.token
    });

    emit('refresh')

    loading.value = false;
}
</script>
