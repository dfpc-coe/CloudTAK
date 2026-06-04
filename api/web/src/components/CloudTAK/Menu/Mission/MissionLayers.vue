<template>
    <MenuTemplate
        v-if='props.menu !== false'
        name='Mission Layers'
        :zindex='0'
        :back='false'
        :border='false'
        :standalone='false'
    >
        <template #buttons>
            <TablerIconButton
                v-if='hasHidden'
                title='Show all layers'
                :size='24'
                @click='showAll'
            >
                <IconEye
                    :size='32'
                    stroke='1'
                />
            </TablerIconButton>
            <TablerIconButton
                v-if='!createLayer && !loading && subscription.role && subscription.role.permissions.includes("MISSION_WRITE")'
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
                :subscription='props.subscription'
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
                label='No Layers'
            />
            <template v-else>
                <MissionLayerTree
                    :orphaned='orphaned'
                    :layers='layers'
                    :feats='feats'
                    :subscription='props.subscription'
                    :hidden-features='hiddenIds'
                    :overlay-visible='overlayVisible'
                    @refresh='refresh'
                    @toggle-hidden='toggleLayer'
                    @toggle-feature-hidden='toggleFeature'
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
            label='No Layers'
        />
        <MissionLayerTree
            v-else
            :orphaned='orphaned'
            :layers='layers'
            :feats='feats'
            :subscription='subscription'
            :hidden-features='hiddenIds'
            :overlay-visible='overlayVisible'
            @refresh='refresh'
            @toggle-hidden='toggleLayer'
            @toggle-feature-hidden='toggleFeature'
        />
    </template>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import {
    IconFolderPlus,
    IconEye,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import type {
    MissionLayer
} from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import OverlayManager from '../../../../base/overlay.ts';
import MenuTemplate from '../../util/MenuTemplate.vue';
import MissionLayerTree from './MissionLayerTree.vue';
import MissionLayerCreate from './MissionLayerCreate.vue';
import { useMapStore } from '../../../../stores/map.ts';

const mapStore = useMapStore();

const props = withDefaults(defineProps<{
    menu?: boolean,
    subscription: Subscription
}>(), {
    menu: true
})

const createLayer = ref(false)
const loading = ref(true);
const feats = ref(new Map());
const orphaned = ref<Set<string>>(new Set());
const layers = ref<Array<MissionLayer>>([]);

// Reactive UI mirror of `subscription.hiddenFeatureIds`. The Subscription owns
// the canonical state (persisted as DB Filter rows keyed by mission GUID); we
// keep this Vue-reactive copy so the tree re-renders eye/eye-off icons
// immediately on toggle without having to query Dexie on every paint.
const hiddenIds = ref<Set<string>>(new Set(props.subscription.hiddenFeatureIds));

const overlayVisible = computed(() => {
    const overlay = OverlayManager.loadedByMode('mission', props.subscription.guid);
    return overlay ? overlay.visible : true;
});

const hasHidden = computed(() => {
    if (!overlayVisible.value) return true;
    return hiddenIds.value.size > 0;
});

onMounted(async () => {
    await refresh();
});

async function refresh() {
    createLayer.value = false;
    loading.value = true;
    await fetchFeats();
    await fetchLayers();
    await syncHiddenIds();
    loading.value = false;
}

async function fetchFeats() {
    const features = await props.subscription.feature.list();

    for (const feat of features) {
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
    layers.value = (await props.subscription.layerList()).data;

    if (layers.value) {
        removeFeatures(layers.value);
    }
}

// ---------------------------------------------------------------------------
// Toggle plumbing.  Each mutation funnels through subscription.{hide,show}*
// (which writes a DB Filter row), then syncs the Vue ref + asks the map store
// to re-pull the mission's filtered feature collection.  No in-memory cache
// of features lives in this component or the Overlay class.
// ---------------------------------------------------------------------------

async function syncHiddenIds(): Promise<void> {
    await props.subscription.loadHiddenFeatureIds();
    hiddenIds.value = new Set(props.subscription.hiddenFeatureIds);
}

async function reloadMissionSource(): Promise<void> {
    try {
        await mapStore.loadMission(props.subscription.guid);
    } catch (err) {
        console.error('Failed to reload mission after hide/show toggle:', err);
    }
}

// Walk a single layer subtree, collecting every CoT UID referenced by it
// (its own uids[], its descendants' uids[], etc.).
function collectSubtreeFeatureIds(layer: MissionLayer, out: Set<string>): void {
    if (layer.uids) {
        for (const cot of layer.uids) {
            if (cot && cot.data) out.add(cot.data);
        }
    }
    if (layer.mission_layers) {
        for (const child of layer.mission_layers as unknown as MissionLayer[]) {
            collectSubtreeFeatureIds(child, out);
        }
    }
}

function findLayerByUid(mlayers: MissionLayer[], uid: string): MissionLayer | undefined {
    for (const l of mlayers) {
        if (l.uid === uid) return l;
        if (l.mission_layers) {
            const child = findLayerByUid(l.mission_layers as unknown as MissionLayer[], uid);
            if (child) return child;
        }
    }
    return undefined;
}

// Cascade KML route waypoints: TAK Server's KML→CoT import emits a parent
// LineString CoT with children whose UIDs follow `<parent-uid>-pt-N` (one per
// waypoint along the line). Hiding the parent without these would leave a
// trail of orphan dots on the map. This is a TAK Server convention rather
// than a node-cot type, so we discover children by uid-prefix scan over the
// currently-loaded feature list.
function expandWithWaypoints(ids: Iterable<string>): Set<string> {
    const out = new Set<string>(ids);
    const seeds = Array.from(out);
    for (const seed of seeds) {
        const prefix = `${seed}-pt-`;
        for (const featId of feats.value.keys()) {
            const sid = String(featId);
            if (sid.startsWith(prefix)) out.add(sid);
        }
    }
    return out;
}

function computeLayerFeatureIds(uid: string): Set<string> {
    const target = findLayerByUid(layers.value, uid);
    const ids = new Set<string>();
    if (target) collectSubtreeFeatureIds(target, ids);
    return expandWithWaypoints(ids);
}

function displayNameFor(featId: string): string {
    const feat = feats.value.get(featId);
    const props = (feat?.properties ?? {}) as Record<string, unknown>;
    return String(props.callsign ?? props.name ?? featId);
}

function displayNamesFor(ids: Iterable<string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const id of ids) out[id] = displayNameFor(id);
    return out;
}

// Flip an overlay back to visible without going through overlay.update so the
// (now-removed) "clear hiddenFeatures on becameVisible" hook can't double-fire.
// Save persists the new visibility to the server.
function flipOverlayVisibleSilently(overlayId: number): void {
    const overlay = OverlayManager.loadedFrom(overlayId);
    if (!overlay) return;
    overlay.visible = true;
    if (mapStore._map) {
        for (const l of overlay.styles) {
            mapStore.map.setLayoutProperty(l.id, 'visibility', 'visible');
        }
    }
    overlay.save().catch((err) => {
        console.error('Failed to persist overlay visibility after auto-promote:', err);
    });
}

// Express "these features should be visible". Three cases:
//   1. parent overlay hidden: auto-promote — hide everything else, flip parent visible
//   2. parent visible, set is currently hidden: additive show (remove from filter)
//   3. parent visible, set is currently visible: no-op
async function showFeatureSet(featureIds: Set<string>): Promise<void> {
    const overlay = OverlayManager.loadedByMode('mission', props.subscription.guid);

    if (overlay && !overlay.visible) {
        // Hide every other feature so only `featureIds` remain visible.
        const everythingElse: string[] = [];
        for (const featId of feats.value.keys()) {
            const sid = String(featId);
            if (!featureIds.has(sid)) everythingElse.push(sid);
        }

        await props.subscription.showAll();
        await props.subscription.hideFeatures(everythingElse, {
            displayNames: displayNamesFor(everythingElse),
        });
        await syncHiddenIds();
        flipOverlayVisibleSilently(overlay.id);
        await reloadMissionSource();
        return;
    }

    await props.subscription.showFeatures(Array.from(featureIds));
    await syncHiddenIds();
    await reloadMissionSource();
}

async function hideFeatureSet(featureIds: Set<string>): Promise<void> {
    await props.subscription.hideFeatures(Array.from(featureIds), {
        displayNames: displayNamesFor(featureIds),
    });
    await syncHiddenIds();
    await reloadMissionSource();
}

async function toggleLayer(uid: string): Promise<void> {
    const subtree = computeLayerFeatureIds(uid);
    if (subtree.size === 0) return;

    const overlay = OverlayManager.loadedByMode('mission', props.subscription.guid);
    if (overlay && !overlay.visible) {
        // Parent-hidden: any click means "show only this one".
        await showFeatureSet(subtree);
        return;
    }

    // Parent-visible: derive intent from current state.
    let allHidden = true;
    for (const fid of subtree) {
        if (!hiddenIds.value.has(fid)) { allHidden = false; break; }
    }
    if (allHidden) {
        await showFeatureSet(subtree);
    } else {
        await hideFeatureSet(subtree);
    }
}

async function toggleFeature(id: string): Promise<void> {
    const set = expandWithWaypoints([id]);

    const overlay = OverlayManager.loadedByMode('mission', props.subscription.guid);
    if (overlay && !overlay.visible) {
        await showFeatureSet(set);
        return;
    }

    if (hiddenIds.value.has(id)) {
        await showFeatureSet(set);
    } else {
        await hideFeatureSet(set);
    }
}

async function showAll(): Promise<void> {
    const overlay = OverlayManager.loadedByMode('mission', props.subscription.guid);

    if (overlay && !overlay.visible) {
        // Clear any prior hides too, then flip the parent back on.
        await props.subscription.showAll();
        await syncHiddenIds();
        try {
            await overlay.update({ visible: true });
        } catch (err) {
            console.error('Failed to re-enable overlay on Show All:', err);
        }
        await reloadMissionSource();
        return;
    }

    if (hiddenIds.value.size === 0) return;
    await props.subscription.showAll();
    await syncHiddenIds();
    await reloadMissionSource();
}
</script>
