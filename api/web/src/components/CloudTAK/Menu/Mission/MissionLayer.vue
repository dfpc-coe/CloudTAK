<template>
    <div
        v-for='layer in layers'
        :key='layer.uid'
    >
        <div class='col-12 hover-dark d-flex align-items-center px-2 py-1'>
            <IconChevronRight
                v-if='layer.type === "UID" && !opened.has(layer.uid)'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='opened.add(layer.uid)'
            />
            <IconChevronDown
                v-else-if='layer.type === "UID" && opened.has(layer.uid)'
                :size='32'
                :stroke='1'
                class='cursor-pointer'
                @click='opened.delete(layer.uid)'
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
                    class='mx-3 ms-auto badge border text-white'
                    :class='{
                        "bg-blue": layer.uids && layer.uids.length > 0,
                        "bg-gray": !layer.uids || layer.uids.length === 0
                    }'
                    v-text='`${layer.uids ? layer.uids.length : 0} Features`'
                />

                <TablerIconButton
                    v-if='role.permissions.includes("MISSION_WRITE")'
                    title='Edit Name'
                    icon='IconPencil'
                    :size='24'
                    @click='edit.add(layer.uid)'
                />

                <TablerDelete
                    v-if='role.permissions.includes("MISSION_WRITE")'
                    displaytype='icon'
                    :size='24'
                    @delete='deleteLayer(layer)'
                />
            </div>
        </div>

        <MissionLayerEdit
            v-if='edit.has(layer.uid)'
            :mission='mission'
            :layer='layer'
            :role='role'
            @cancel='edit.delete(layer.uid)'
            @layer='refresh'
        />
        <div
            v-else-if='opened.has(layer.uid) && layer.type === "UID"'
            class='mx-2'
        >
            <Feature
                v-for='cot of layer.uids'
                :key='cot.data'
                :delete-button='false'
                :feature='feats.get(cot.data)'
                :mission='mission'
            />
            <MissionLayer
                v-if='layer.mission_layers && layer.mission_layers.length'
                :layers='layer.mission_layers'
                :mission='mission'
                :token='token'
                :role='role'
            />

            <TablerNone
                v-if='!layer.uids || !layer.uids.length'
                :create='false'
                :compact='true'
                class='py-2'
            />
        </div>
    </div>
</template>

<script setup lang='ts'>
import { ref } from 'vue';
import { std, stdurl } from '../../../../../src/std.ts';
import MissionLayer from './MissionLayer.vue';
import {
    IconChevronRight,
    IconChevronDown,
    IconFiles,
    IconMapPins,
    IconFolder,
    IconMap,
    IconPin,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerDelete,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import Feature from '../../util/Feature.vue';
import MissionLayerEdit from './MissionLayerEdit.vue';

defineProps({
    layers: Array,
    feats: Map,
    mission: Object,
    token: String,
    role: Object,
});

const opened = ref<Set<string>>(new Set());
const edit = ref<Set<string>>(new Set());
const loading = ref<Set<string>>(new Set());

async function deleteLayer(layer: MissionLayer) {
    loading.value.set(layer.uid)
    const url = stdurl(`/api/marti/missions/${this.mission.name}/layer/${layer.uid}`);

    await std(url, {
        method: 'DELETE',
        headers: {
            MissionAuthorization: this.token
        },
    })

    loading.value.delete(layer.uid);
}
</script>
