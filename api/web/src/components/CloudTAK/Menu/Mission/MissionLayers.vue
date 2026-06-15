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
            label='No Layers'
        />
        <MissionLayerTree
            v-else
            :orphaned='orphaned'
            :layers='layers'
            :feats='feats'
            :subscription='subscription'
            @refresh='refresh'
        />
    </template>
</template>

<script setup lang='ts'>
import { ref, computed, onMounted } from 'vue';
import { liveQuery } from 'dexie';
import { useObservable } from '@vueuse/rxjs';
import { from } from 'rxjs';
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
    Feature,
    MissionLayer
} from '../../../../types.ts';
import Subscription from '../../../../base/subscription.ts';
import MenuTemplate from '../../util/MenuTemplate.vue';
import MissionLayerTree from './MissionLayerTree.vue';
import MissionLayerCreate from './MissionLayerCreate.vue';

const props = withDefaults(defineProps<{
    menu?: boolean,
    subscription: Subscription
}>(), {
    menu: true
})

const createLayer = ref(false)
const refreshing = ref(false);

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

const orphaned = computed<Set<string>>(() => {
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

    const result = new Set<string>();
    for (const id of feats.value.keys()) {
        if (!assigned.has(id)) result.add(id);
    }

    return result;
});

onMounted(async () => {
    await refresh();
});

async function refresh() {
    createLayer.value = false;
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
