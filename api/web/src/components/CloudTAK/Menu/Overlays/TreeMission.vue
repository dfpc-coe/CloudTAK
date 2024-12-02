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
import { ref } from 'vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import Overlay from '../../../../../src/stores/base/overlay.ts'
import MissionLayers from '../Mission/MissionLayers.vue';
import { useCOTStore } from '../../../../../src/stores/cots.ts';
const cotStore = useCOTStore();

const props = defineProps<{
    overlay: Overlay
}>()

const subscription = ref(cotStore.subscriptions.get(props.overlay.mode_id || ''));
</script>
