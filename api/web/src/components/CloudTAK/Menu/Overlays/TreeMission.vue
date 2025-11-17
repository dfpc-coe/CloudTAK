<template>
    <TablerLoading v-if='!subscription' />
    <div
        v-else
        @click.stop
    >
        <MissionLayers
            :menu='false'
            :subscription='subscription'
        />
    </div>
</template>

<script setup lang='ts'>
import { ref, onMounted } from 'vue';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import Overlay from '../../../../base/overlay.ts'
import Subscription from '../../../../base/subscription.ts'
import MissionLayers from '../Mission/MissionLayers.vue';

const props = defineProps<{
    overlay: Overlay
}>()

const subscription = ref<Subscription | undefined >(undefined);

onMounted(async () => {
    subscription.value = await Subscription.from(props.overlay.mode_id || '', localStorage.token);
});
</script>
