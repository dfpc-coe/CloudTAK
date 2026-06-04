<template>
    <TablerLoading v-if='loading' />
    <template v-else>
        <template
            v-for='layer in layers'
            :key='layer.uid'
        >
            <div class='col-12 cloudtak-hover d-flex align-items-center px-3 py-2'>
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
                    :class='{ "text-muted": isHidden(layer) }'
                    v-text='layer.name'
                />

                <div class='ms-auto btn-list d-flex align-items-center'>
                    <span
                        v-if='layer.type === "UID"'
                        class='mx-3 ms-auto'
                    >
                        <TablerBadge
                            :background-color='layer.uids && layer.uids.length > 0 ? "rgba(59, 130, 246, 0.25)" : "rgba(107, 114, 128, 0.2)"'
                            :border-color='layer.uids && layer.uids.length > 0 ? "rgba(59, 130, 246, 0.5)" : "rgba(107, 114, 128, 0.5)"'
                            :text-color='layer.uids && layer.uids.length > 0 ? "#2563eb" : "#6b7280"'
                        >{{ `${layer.uids ? layer.uids.length : 0} Features` }}</TablerBadge>
                    </span>

                    <TablerIconButton
                        v-if='canHide(layer)'
                        :title='isHidden(layer) ? "Show layer" : "Hide layer"'
                        :disabled='parentHidden'
                        :size='24'
                        @click='emit("toggleHidden", layer.uid)'
                    >
                        <IconEyeOff
                            v-if='isHidden(layer)'
                            :size='20'
                            stroke='1'
                        />
                        <IconEye
                            v-else
                            :size='20'
                            stroke='1'
                        />
                    </TablerIconButton>

                    <TablerIconButton
                        v-if='props.subscription.role.permissions.includes("MISSION_WRITE")'
                        title='Edit Name'
                        :size='24'
                        @click='edit.add(layer.uid)'
                    >
                        <IconPencil stroke='1' />
                    </TablerIconButton>

                    <TablerDelete
                        v-if='props.subscription.role.permissions.includes("MISSION_WRITE")'
                        displaytype='icon'
                        :size='24'
                        @delete='deleteLayer(layer)'
                    />
                </div>
            </div>

            <MissionLayerEdit
                v-if='edit.has(layer.uid)'
                :subscription='props.subscription'
                :layer='layer'
                @cancel='edit.delete(layer.uid)'
                @layer='emit("refresh")'
            />

            <div
                v-else-if='opened.has(layer.uid) && layer.type === "UID"'
                class='mx-2'
            >
                <FeatureRow
                    v-for='cot of cots(layer)'
                    :key='cot.id'
                    :delete-button='false'
                    :feature='cot'
                    :hide-button='true'
                    :hidden='isFeatureHidden(cot.id) || isHidden(layer)'
                    @toggle-hidden='emit("toggleFeatureHidden", String(cot.id))'
                />
                <MissionLayerTree
                    v-if='layer.mission_layers && layer.mission_layers.length'
                    :layers='layer.mission_layers as Array<MissionLayer>'
                    :feats='feats'
                    :subscription='subscription'
                    :hidden-features='props.hiddenFeatures'
                    :overlay-visible='overlayVisible'
                    :parent-hidden='parentHidden || isLayerSubtreeAllHidden(layer)'
                    @refresh='emit("refresh")'
                    @toggle-hidden='(uid: string) => emit("toggleHidden", uid)'
                    @toggle-feature-hidden='(id: string) => emit("toggleFeatureHidden", id)'
                />
                <TablerNone
                    v-if='!layer.uids || !layer.uids.length'
                    :create='false'
                    :compact='true'
                    class='py-2'
                />
            </div>
        </template>

        <FeatureRow
            v-for='feat of orphanedFeats'
            :key='feat.id'
            :delete-button='false'
            :feature='feat'
            :hide-button='true'
            :hidden='isFeatureHidden(feat.id)'
            @toggle-hidden='emit("toggleFeatureHidden", String(feat.id))'
        />
    </template>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import type { MissionLayer, Feature } from '../../../../types.ts';
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
    IconEye,
    IconEyeOff,
} from '@tabler/icons-vue';
import {
    TablerBadge,
    TablerNone,
    TablerDelete,
    TablerLoading,
    TablerIconButton,
} from '@tak-ps/vue-tabler';
import FeatureRow from '../../util/FeatureRow.vue';
import MissionLayerEdit from './MissionLayerEdit.vue';

const emit = defineEmits<{
    (e: 'refresh'): void;
    (e: 'toggleHidden', uid: string): void;
    (e: 'toggleFeatureHidden', id: string): void;
}>();

const props = withDefaults(defineProps<{
    layers: Array<MissionLayer>,
    feats: Map<string, Feature>,
    subscription: Subscription,
    orphaned?: Set<string>,
    hiddenFeatures?: Set<string>,
    overlayVisible?: boolean,
    parentHidden?: boolean,
}>(), {
    orphaned: () => new Set<string>(),
    hiddenFeatures: () => new Set<string>(),
    overlayVisible: true,
    parentHidden: false
});

function collectLayerSubtreeIds(layer: MissionLayer, out: Set<string>): void {
    if (layer.uids) {
        for (const cot of layer.uids) {
            if (cot && cot.data) out.add(cot.data);
        }
    }
    if (layer.mission_layers) {
        for (const child of layer.mission_layers as unknown as MissionLayer[]) {
            collectLayerSubtreeIds(child, out);
        }
    }
    // Cascade waypoints owned by any CoT in the subtree.
    const seeds = Array.from(out);
    for (const seed of seeds) {
        const prefix = `${seed}-pt-`;
        for (const featId of props.feats.keys()) {
            const sid = String(featId);
            if (sid.startsWith(prefix)) out.add(sid);
        }
    }
}

// A layer reports as hidden when every CoT it (or its descendants) reference
// is in the hiddenFeatures set. With no features at all it's never hidden.
function isHidden(layer: MissionLayer): boolean {
    if (!props.overlayVisible) return true;
    if (props.parentHidden) return true;

    const subtree = new Set<string>();
    collectLayerSubtreeIds(layer, subtree);
    if (subtree.size === 0) return false;

    for (const fid of subtree) {
        if (!props.hiddenFeatures.has(fid)) return false;
    }
    return true;
}

// Mirror of isHidden, used to pass the parent-hidden flag into nested
// MissionLayerTree recursions. Identical to isHidden(layer) right now but
// expressed as a layer-only predicate (no overlayVisible override) so the
// recursion still works when overlayVisible is true.
function isLayerSubtreeAllHidden(layer: MissionLayer): boolean {
    const subtree = new Set<string>();
    collectLayerSubtreeIds(layer, subtree);
    if (subtree.size === 0) return false;
    for (const fid of subtree) {
        if (!props.hiddenFeatures.has(fid)) return false;
    }
    return true;
}

function isFeatureHidden(id: string | number): boolean {
    // Implicit-hide for orphaned feature rows when the overlay is off.
    if (!props.overlayVisible) return true;
    return props.hiddenFeatures.has(String(id));
}

function canHide(layer: MissionLayer): boolean {
    // Any container layer that may carry CoT references can be hidden.
    // GROUPs cascade through children; UID/ITEM layers expose their own uids[].
    return layer.type === 'UID' || layer.type === 'GROUP' || layer.type === 'ITEM';
}

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

    await props.subscription.layerDelete(layer.uid);

    emit('refresh')

    loading.value = false;
}
</script>
