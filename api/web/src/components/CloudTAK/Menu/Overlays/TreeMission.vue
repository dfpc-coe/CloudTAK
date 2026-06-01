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
import { Preferences } from '@capacitor/preferences';
import {
    TablerLoading
} from '@tak-ps/vue-tabler';
import Overlay from '../../../../base/overlay-class.ts'
import Subscription from '../../../../base/subscription.ts'
import MissionLayers from '../Mission/MissionLayers.vue';

const props = defineProps<{
    overlay: Overlay
}>()

const subscription = ref<Subscription | undefined >(undefined);

onMounted(async () => {
    const { value: token } = await Preferences.get({ key: 'token' });
    subscription.value = await Subscription.from(props.overlay.mode_id || '', token || '');
});
</script>
