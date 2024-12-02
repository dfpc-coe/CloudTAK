<template>
    <TablerLoading v-if='!subscription' />
    <div 
        v-else
        class='ms-3'
    >
        <MissionLayers
            :mission='subscription.meta'
            :token='subscription.token'
            :role='subscription.role'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, computed } from 'vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import Overlay from '../../../../../src/stores/base/overlay.ts'
import MissionLayers from '../Mission/MissionLayers.vue';
import type { Feature } from '../../../../../src/types.ts';
import { useCOTStore } from '../../../../../src/stores/cots.ts';
const cotStore = useCOTStore();

const props = defineProps<{
    overlay: Overlay
}>()

const feats = computed<Map<string, Feature>>(() => {
    const map = new Map();
    if (!subscription.value) return map;

    Array.from(subscription.value.cots.values()).forEach((cot) => {
        const feat = cot.as_feature();
        map.set(feat.id, feat);
    })

    return map;
})

const subscription = ref(cotStore.subscriptions.get(props.overlay.mode_id || ''));
</script>
