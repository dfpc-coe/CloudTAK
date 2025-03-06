<template>
    <TablerLoading v-if='!subscription' />
    <div
        v-else
        class='ms-3'
    >
        <MissionLayers
            :menu='false'
            :mission='subscription.meta'
            :token='subscription.token'
            :role='subscription.role'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import Overlay from '../../../../stores/base/overlay.ts'
import Subscription from '../../../../base/subscription.ts'
import MissionLayers from '../Mission/MissionLayers.vue';
import { useMapStore } from '../../../../stores/map.ts';
const mapStore = useMapStore();

const props = defineProps<{
    overlay: Overlay
}>()

const subscription = ref<Subscription | undefined >(undefined);

onMounted(async () => {
    subscription.value = await mapStore.worker.db.subscriptionGet(props.overlay.mode_id || '');
});
</script>
