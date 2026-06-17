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
                v-if='!createLayer && !loading && writable'
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

        <div class='col-12'>
            <TablerLoading
                v-if='loading'
                class='mx-2'
                desc='Loading Layers...'
            />
            <template v-else>
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
                <div
                    v-if='editLayer'
                    class='col-12 px-2 pb-4'
                >
                    <MissionLayerEdit
                        :subscription='props.subscription'
                        :layer='editLayer'
                        @layer='refresh'
                        @cancel='editLayer = undefined'
                    />
                </div>

                <div class='d-flex align-items-center gap-2 px-2 py-2'>
                    <TablerIconButton
                        title='Home'
                        @click='navigateHome'
                    >
                        <IconFolder
                            :size='20'
                            stroke='1'
                        />
                    </TablerIconButton>
                    <template
                        v-for='(crumb, idx) in pathStack'
                        :key='crumb.uid'
                    >
                        <IconChevronRight
                            :size='20'
                            stroke='1'
                            class='text-white-50'
                        />
                        <span
                            class='fw-semibold cursor-pointer'
                            @click='navigateToCrumb(idx)'
                        >{{ tree.layerMap.get(crumb.uid)?.name ?? '(deleted)' }}</span>
                    </template>
                    <span
                        v-if='!pathStack.length'
                        class='small text-white-50'
                    >/</span>
                </div>

                <TablerNone
                    v-if='!currentFolders.length && !currentItems.length'
                    :create='false'
                    :compact='true'
                    :label='pathStack.length ? "Folder is empty" : "No Layers"'
                />
                <template v-else>
                    <PathBrowser
                        v-if='currentFolders.length'
                        :nodes='currentFolders'
                        :renamable='writable'
                        :deletable='writable'
                        :visibility-toggle='true'
                        :is-node-hidden='isMissionFolderHidden'
                        @navigate='navigateToFolder'
                        @delete='deleteLayer'
                        @rename='openEdit'
                        @toggle-visibility='toggleMissionFolderVisibility'
                    />
                    <div class='mt-2'>
                        <FeatureRow
                            v-for='feat of currentItems'
                            :key='feat.id'
                            :delete-button='false'
                            :visibility-toggle='true'
                            :feature='feat'
                        />
                    </div>
                </template>
            </template>
        </div>
    </MenuTemplate>
    <div
        v-else
        class='col-12'
    >
        <TablerLoading
            v-if='loading'
            class='mx-2'
            desc='Loading Layers...'
        />
        <template v-else>
            <div
                v-if='editLayer'
                class='col-12 px-2 pb-4'
            >
                <MissionLayerEdit
                    :subscription='props.subscription'
                    :layer='editLayer'
                    @layer='refresh'
                    @cancel='editLayer = undefined'
                />
            </div>

            <div class='d-flex align-items-center gap-2 px-2 py-2'>
                <TablerIconButton
                    title='Home'
                    @click='navigateHome'
                >
                    <IconFolder
                        :size='20'
                        stroke='1'
                    />
                </TablerIconButton>
                <template
                    v-for='(crumb, idx) in pathStack'
                    :key='crumb.uid'
                >
                    <IconChevronRight
                        :size='20'
                        stroke='1'
                        class='text-white-50'
                    />
                    <span
                        class='fw-semibold cursor-pointer'
                        @click='navigateToCrumb(idx)'
                    >{{ tree.layerMap.get(crumb.uid)?.name ?? '(deleted)' }}</span>
                </template>
                <span
                    v-if='!pathStack.length'
                    class='small text-white-50'
                >/</span>
            </div>

            <TablerNone
                v-if='!currentFolders.length && !currentItems.length'
                :create='false'
                :compact='true'
                :label='pathStack.length ? "Folder is empty" : "No Layers"'
            />
            <template v-else>
                <PathBrowser
                    v-if='currentFolders.length'
                    :nodes='currentFolders'
                    :renamable='writable'
                    :deletable='writable'
                    :visibility-toggle='true'
                    :is-node-hidden='isMissionFolderHidden'
                    @navigate='navigateToFolder'
                    @delete='deleteLayer'
                    @rename='openEdit'
                    @toggle-visibility='toggleMissionFolderVisibility'
                />
                <div class='mt-2'>
                    <FeatureRow
                        v-for='feat of currentItems'
                        :key='feat.id'
                        :delete-button='false'
                        :visibility-toggle='true'
                        :feature='feat'
                    />
                </div>
            </template>
        </template>
    </div>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { liveQuery } from 'dexie';
import { useObservable } from '@vueuse/rxjs';
import { from } from 'rxjs';
import {
    IconFolder,
    IconFolderPlus,
    IconChevronRight,
} from '@tabler/icons-vue';
import {
    TablerNone,
    TablerLoading,
    TablerIconButton,
    TablerRefreshButton,
} from '@tak-ps/vue-tabler';
import type {
    Feature,
    MissionLayer
} from '../../../../types.ts';
import type { PathNode } from '../../../../base/path-manager.ts';
import PathManager from '../../../../base/path-manager.ts';
import { FeatureVisibility } from '../../../../stores/modules/feature-visibility.ts';
import Subscription from '../../../../base/subscription.ts';
import MenuTemplate from '../../util/MenuTemplate.vue';
import PathBrowser from '../../util/PathBrowser.vue';
import FeatureRow from '../../util/FeatureRow.vue';
import MissionLayerCreate from './MissionLayerCreate.vue';
import MissionLayerEdit from './MissionLayerEdit.vue';

const props = withDefaults(defineProps<{
    menu?: boolean,
    subscription: Subscription
}>(), {
    menu: true
})

const createLayer = ref(false);
const editLayer = ref<MissionLayer | undefined>();
const refreshing = ref(false);
const currentUid = ref<string | null>(null);
const pathStack = ref<Array<{ uid: string, name: string }>>([]);

const writable = computed<boolean>(() => {
    return !!props.subscription.role
        && props.subscription.role.permissions.includes('MISSION_WRITE');
});

const featList = useObservable<Array<Feature> | undefined>(
    from(liveQuery(async () => {
        return await props.subscription.feature.list();
    }))
);

const layerObs = useObservable<Array<MissionLayer> | undefined>(
    from(liveQuery(async () => {
        return await props.subscription.layer.list();
    }))
);

const loading = computed<boolean>(() => {
    return refreshing.value
        || featList.value === undefined
        || layerObs.value === undefined;
});

const layers = computed<Array<MissionLayer>>(() => {
    return layerObs.value || [];
});

const feats = computed<Map<string, Feature>>(() => {
    const map = new Map<string, Feature>();
    for (const feat of featList.value || []) {
        map.set(String(feat.id), feat);
    }
    return map;
});

/**
 * Adapt the recursive Mission Layer tree into the generic PathNode tree
 * consumed by PathBrowser. Only GROUP & UID layers are surfaced as folders;
 * a sidecar map preserves the original layer for mutation handlers.
 */
const tree = computed<{ nodes: PathNode<Feature>[], layerMap: Map<string, MissionLayer> }>(() => {
    const layerMap = new Map<string, MissionLayer>();

    const build = (mlayers: MissionLayer[], parentPath: string): PathNode<Feature>[] => {
        const nodes: PathNode<Feature>[] = [];

        for (const layer of mlayers) {
            if (layer.type !== 'GROUP' && layer.type !== 'UID') continue;

            layerMap.set(layer.uid, layer);

            const fullPath = parentPath === '/' ? `/${layer.name}` : `${parentPath}/${layer.name}`;

            const items = new Set<Feature>();
            if (layer.type === 'UID' && layer.uids) {
                for (const uid of layer.uids) {
                    const feat = feats.value.get(uid.data);
                    if (feat) items.add(feat);
                }
            }

            const children = layer.mission_layers
                // @ts-expect-error Due to recursive type limits this is unknown
                ? build(layer.mission_layers, fullPath)
                : [];

            nodes.push({
                id: layer.uid,
                name: layer.name,
                fullPath,
                count: items.size,
                opened: false,
                loading: false,
                children,
                items,
            });
        }

        nodes.sort((a, b) => a.name.localeCompare(b.name));

        return nodes;
    };

    return { nodes: build(layers.value, '/'), layerMap };
});

const orphanedFeats = computed<Feature[]>(() => {
    const assigned = new Set<string>();

    const collect = (mlayers: MissionLayer[]): void => {
        for (const layer of mlayers) {
            if (layer.type === 'UID' && layer.uids && layer.uids.length) {
                for (const cot of layer.uids) {
                    assigned.add(cot.data);
                }
            }

            if (layer.mission_layers) {
                // @ts-expect-error Due to recursive type limits this is unknown
                collect(layer.mission_layers);
            }
        }
    };

    collect(layers.value);

    const result: Feature[] = [];
    for (const [id, feat] of feats.value) {
        if (!assigned.has(id)) result.push(feat);
    }

    return result;
});

const currentFolders = computed<PathNode<Feature>[]>(() => {
    if (!currentUid.value) return tree.value.nodes;
    const node = PathManager.findNodeById(tree.value.nodes, currentUid.value);
    return node ? node.children : tree.value.nodes;
});

const currentItems = computed<Feature[]>(() => {
    if (!currentUid.value) return orphanedFeats.value;
    const node = PathManager.findNodeById(tree.value.nodes, currentUid.value);
    return node ? Array.from(node.items) : orphanedFeats.value;
});

/**
 * Collect every feature id contained within a mission folder node, recursing
 * into child folders. Mission "folders" are server-defined layer groups rather
 * than feature `path` values, so visibility is toggled by the contained ids.
 */
function collectNodeIds(node: PathNode<Feature>): string[] {
    const ids: string[] = [];

    for (const feat of node.items) {
        ids.push(feat.id);
    }

    for (const child of node.children) {
        ids.push(...collectNodeIds(child));
    }

    return ids;
}

function isMissionFolderHidden(node: PathNode<Feature>): boolean {
    return FeatureVisibility.areFeaturesHidden(collectNodeIds(node));
}

function toggleMissionFolderVisibility(node: PathNode<Feature>): void {
    const ids = collectNodeIds(node);
    FeatureVisibility.setFeaturesHidden(ids, !FeatureVisibility.areFeaturesHidden(ids));
}

function navigateHome(): void {
    currentUid.value = null;
    pathStack.value = [];
}

function navigateToFolder(node: PathNode<Feature>): void {
    pathStack.value.push({ uid: node.id, name: node.name });
    currentUid.value = node.id;
}

function navigateToCrumb(idx: number): void {
    const crumb = pathStack.value[idx];
    pathStack.value = pathStack.value.slice(0, idx + 1);
    currentUid.value = crumb.uid;
}

function openEdit(node: PathNode<Feature>): void {
    editLayer.value = tree.value.layerMap.get(node.id);
}

async function deleteLayer(node: PathNode<Feature>): Promise<void> {
    await props.subscription.layer.delete(node.id);
}

onMounted(async () => {
    await refresh();
});

async function refresh() {
    createLayer.value = false;
    editLayer.value = undefined;
    refreshing.value = true;
    try {
        await Promise.all([
            props.subscription.feature.refresh(),
            props.subscription.layer.refresh(),
        ]);
    } finally {
        refreshing.value = false;
    }
}
</script>
